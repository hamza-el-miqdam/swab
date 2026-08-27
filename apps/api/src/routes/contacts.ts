import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import type {
  ContactRecord,
  ContactsRepository,
  CreateContactInput,
  PatchContactInput,
} from "../repo.js";
import { requireAuth } from "../lib/auth.js";
import { sendProblem, zodDetail } from "../lib/problem.js";
import { displayNameSchema, phoneHashSchema, rowIdSchema } from "../lib/validation.js";
import { decodeCursor, encodeCursor, MAX_CURSOR_LENGTH } from "../contacts/cursor.js";
import {
  ETAT_VALUES,
  RESSENTI_VALUES,
  RING_MAX,
  RING_MIN,
  type Axis,
} from "../contacts/vocabulary.js";

/**
 * Typed classification endpoints (ADR-001 stage 3) — the replacement for the
 * deprecated `GET/POST /vault` blob, which stays in place until stage 4 cuts
 * the clients over.
 *
 * Conventions established here, deliberately, because the rest of the ADR-001
 * series and the still-undrafted FS-05 OpenAPI seam will copy them:
 *
 *  1. **Resource naming** — `/contacts`, the noun ADR-001 itself uses
 *     (`PATCH /contacts/{id}` style). The table is `ContactLink` because the row
 *     is an edge; the *resource* a client manipulates is a contact.
 *  2. **Mutation id in a header, not the body** — `Idempotency-Key`, the
 *     IETF/industry convention. Decisive reason: `DELETE` needs one too, and a
 *     body on `DELETE` is unreliable across HTTP stacks. It is also transport
 *     metadata, so it never pollutes a resource schema. Required, not optional:
 *     VLT-07 says *every* mutation carries one.
 *  3. **One response envelope for every write** — `{ outcome, contact,
 *     staleFields? }`. `outcome` is `applied` | `no_op` | `already_applied`.
 *     `contact` is null only for `already_applied`, because the ledger caches no
 *     response body by design (VLT-03) and the client re-pulls by cursor.
 *  4. **Errors are RFC 7807** via `sendProblem`, and never echo a submitted
 *     value — a 400 on a classification field would otherwise put that field in
 *     an error payload (VLT-03).
 *  5. **A tombstone serialises to `{ id, deleted: true, updatedAt, deletedAt }`
 *     and nothing else.** A deleted contact's classification never travels
 *     again; the client only needs to drop it.
 *
 * Logging (VLT-03/G3): ids, outcomes and counts only. Not field *names* either
 * — "ressenti changed" still says something about the relationship — and not the
 * client-chosen mutation id, which is free text under a permissive charset.
 */

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

/**
 * `ClientMutation.id` is VarChar(64). The floor of 8 is a guard-rail for the
 * client, not for us: a short id makes an accidental self-collision — two
 * different mutations sharing an id — silently drop a write.
 */
const mutationIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "must be an opaque client-generated id");

const ringSchema = z.number().int().min(RING_MIN).max(RING_MAX);
const etatSchema = z.enum(ETAT_VALUES);
const ressentiSchema = z.enum(RESSENTI_VALUES);

const createBodySchema = z
  .object({
    targetId: rowIdSchema.optional(),
    invitedPhoneHash: phoneHashSchema.optional(),
    displayName: displayNameSchema.optional(),
    ring: ringSchema.optional(),
    etat: etatSchema.optional(),
    ressenti: ressentiSchema.optional(),
  })
  .refine((body) => (body.targetId === undefined) !== (body.invitedPhoneHash === undefined), {
    // Mirrors the `contact_links_resolved_or_pending` CHECK: a row is either
    // resolved or a pending invite, never both and never neither.
    message: "exactly one of targetId or invitedPhoneHash is required",
  });

/**
 * A field write carries the server timestamp the client last saw for THAT field
 * (VLT-09). `null` means "I have never seen a server value here". Client clocks
 * are never read (VLT-08) — this is an echo of a server-issued value, which is
 * why it is a base rather than a "when I edited it".
 */
function fieldWriteSchema<T extends z.ZodType>(value: T) {
  return z.object({
    value: value.nullable(),
    baseUpdatedAt: z.iso.datetime().nullable(),
  });
}

const patchBodySchema = z
  .object({
    displayName: fieldWriteSchema(displayNameSchema).optional(),
    ring: fieldWriteSchema(ringSchema).optional(),
    etat: fieldWriteSchema(etatSchema).optional(),
    ressenti: fieldWriteSchema(ressentiSchema).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "at least one field is required" });

const listQuerySchema = z.object({
  since: z.string().max(MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export interface ContactRouteDeps {
  env: Env;
  repo: ContactsRepository;
}

export type WireContact = Record<string, unknown>;

/**
 * Exported so `routes/contact-roles.ts` (ADR-001 stage 3 slice 2, part 2/2)
 * can serialize the parent contact its write envelope returns, rather than
 * re-implementing the tombstone-vs-live shape (convention 5 above).
 */
export function serializeContact(contact: ContactRecord): WireContact {
  if (contact.deletedAt !== null) {
    // Convention 5: a tombstone is an instruction to forget, not a record.
    return {
      id: contact.id,
      deleted: true,
      updatedAt: contact.updatedAt.toISOString(),
      deletedAt: contact.deletedAt.toISOString(),
    };
  }
  return {
    id: contact.id,
    deleted: false,
    targetId: contact.targetId,
    invitedPhoneHash: contact.invitedPhoneHash,
    displayName: contact.displayName,
    ring: contact.ring,
    etat: contact.etat,
    ressenti: contact.ressenti,
    // Echoed back on the client's next write to this contact — the LWW bases.
    fieldUpdatedAt: {
      displayName: iso(contact.fieldUpdatedAt.displayName),
      ring: iso(contact.fieldUpdatedAt.ring),
      etat: iso(contact.fieldUpdatedAt.etat),
      ressenti: iso(contact.fieldUpdatedAt.ressenti),
    },
    lastAxisChangeAt: iso(contact.lastAxisChangeAt),
    stalenessSnoozedUntil: iso(contact.stalenessSnoozedUntil),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

/**
 * `null` + a 400 already sent when the header is missing or malformed.
 * Exported for `routes/contact-roles.ts` — same VLT-07 header, same rules.
 */
export function readMutationId(req: FastifyRequest, reply: FastifyReply): string | null {
  const parsed = mutationIdSchema.safeParse(req.headers["idempotency-key"]);
  if (parsed.success) return parsed.data;
  sendProblem(
    reply,
    400,
    "Missing or invalid Idempotency-Key",
    "Every write carries a client-generated Idempotency-Key header (8-64 chars, [A-Za-z0-9_-]).",
  );
  return null;
}

/**
 * Drops keys the client omitted rather than passing them through as
 * `undefined`: with `exactOptionalPropertyTypes`, "absent" and "present but
 * undefined" are different, and the repository treats absent as "do not touch".
 */
function toCreateInput(body: z.infer<typeof createBodySchema>): CreateContactInput {
  const input: CreateContactInput = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) Object.assign(input, { [key]: value });
  }
  return input;
}

/** Wire `{ value, baseUpdatedAt }` → domain `FieldWrite`. Only the parsed keys are carried over. */
function toPatchInput(body: z.infer<typeof patchBodySchema>): PatchContactInput {
  const input: PatchContactInput = {};
  for (const axis of Object.keys(body) as Axis[]) {
    const write = body[axis];
    if (write === undefined) continue;
    Object.assign(input, {
      [axis]: {
        value: write.value,
        baseUpdatedAt: write.baseUpdatedAt === null ? null : new Date(write.baseUpdatedAt),
      },
    });
  }
  return input;
}

export function registerContactRoutes(app: FastifyInstance, deps: ContactRouteDeps): void {
  const auth = requireAuth(deps.env);
  const { repo } = deps;

  app.post("/contacts", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");
    const mutationId = readMutationId(req, reply);
    if (mutationId === null) return reply;

    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }
    if (parsed.data.targetId === userId) {
      // Backstop for the `contact_links_no_self_link` CHECK — a self-link has no
      // product meaning and would pollute recipient resolution later.
      return sendProblem(reply, 422, "Cannot link to yourself");
    }

    const result = await repo.createContact(userId, mutationId, toCreateInput(parsed.data));
    switch (result.outcome) {
      case "already_applied":
        req.log.info({ userId }, "contact create replayed");
        return reply.code(200).send({ outcome: "already_applied", contact: null });
      case "duplicate":
        return sendProblem(
          reply,
          409,
          "Contact already exists",
          "A live contact for this person already exists. Pull by cursor and patch it instead.",
        );
      case "unknown_target":
        return sendProblem(reply, 422, "Unknown target user");
      case "created":
        req.log.info({ userId, contactId: result.contact.id }, "contact created");
        return reply
          .code(201)
          .header("location", `/contacts/${result.contact.id}`)
          .send({ outcome: "applied", contact: serializeContact(result.contact) });
    }
  });

  app.patch("/contacts/:id", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");
    const mutationId = readMutationId(req, reply);
    if (mutationId === null) return reply;

    const params = z.object({ id: rowIdSchema }).safeParse(req.params);
    if (!params.success) return sendProblem(reply, 404, "Contact not found");
    const parsed = patchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }

    const result = await repo.patchContact(
      userId,
      mutationId,
      params.data.id,
      toPatchInput(parsed.data),
    );
    if (result.outcome === "already_applied") {
      req.log.info({ userId, contactId: params.data.id }, "contact patch replayed");
      return reply.code(200).send({ outcome: "already_applied", contact: null });
    }
    // "Not yours" and "does not exist" answer identically — otherwise the id
    // itself becomes an existence oracle for another user's data (IDT-08).
    if (result.outcome === "not_found") return sendProblem(reply, 404, "Contact not found");

    req.log.info(
      {
        userId,
        contactId: result.contact.id,
        outcome: result.outcome,
        // Counts, never field names: "ressenti changed" is itself a statement
        // about the relationship (VLT-03).
        stale: result.staleFields.length,
      },
      "contact patched",
    );
    return reply.code(200).send({
      outcome: result.outcome,
      contact: serializeContact(result.contact),
      // Reported, never swallowed: the client must be able to tell the user its
      // edit lost, and to reconcile its outbox (product ethos — nothing hidden).
      ...(result.staleFields.length > 0 ? { staleFields: result.staleFields } : {}),
    });
  });

  app.delete("/contacts/:id", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");
    const mutationId = readMutationId(req, reply);
    if (mutationId === null) return reply;

    const params = z.object({ id: rowIdSchema }).safeParse(req.params);
    if (!params.success) return sendProblem(reply, 404, "Contact not found");

    const result = await repo.deleteContact(userId, mutationId, params.data.id);
    if (result.outcome === "already_applied") {
      req.log.info({ userId, contactId: params.data.id }, "contact delete replayed");
      return reply.code(200).send({ outcome: "already_applied", contact: null });
    }
    if (result.outcome === "not_found") return sendProblem(reply, 404, "Contact not found");

    req.log.info({ userId, contactId: result.contact.id, outcome: result.outcome }, "contact deleted");
    return reply
      .code(200)
      .send({ outcome: result.outcome, contact: serializeContact(result.contact) });
  });

  app.get("/contacts", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid query", zodDetail(parsed.error));
    }
    const { since, limit } = parsed.data;
    const cursor = since === undefined ? null : decodeCursor(since);
    if (since !== undefined && cursor === null) {
      // Never fall back to a silent full re-sync: the client would think it had
      // a working cursor while re-downloading everything on every pull.
      return sendProblem(reply, 400, "Invalid cursor", "Re-sync without `since` to start over.");
    }

    const page = await repo.listContactsSince(userId, cursor, limit);
    req.log.info(
      { userId, returned: page.contacts.length, hasMore: page.hasMore },
      "contacts delta pull",
    );
    return reply.code(200).send({
      contacts: page.contacts.map(serializeContact),
      nextCursor: page.nextCursor === null ? null : encodeCursor(page.nextCursor),
      hasMore: page.hasMore,
    });
  });
}
