import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import type { ContactRolesRepository, ContactsRepository } from "../repo.js";
import { requireAuth } from "../lib/auth.js";
import { sendProblem, zodDetail } from "../lib/problem.js";
import { rowIdSchema } from "../lib/validation.js";
import { ROLE_VALUES } from "../contacts/vocabulary.js";
import { readMutationId, serializeContact } from "./contacts.js";

/**
 * Rôles·contexte HTTP surface (ADR-001 stage 3 slice 2, part 2/2) — the
 * routes the repository layer (PR 1, `ContactRolesRepository` on
 * `prisma-contacts-repo.ts` / `fake-repo.ts`) needed.
 *
 * Kept in its own file rather than folded into `registerContactRoutes`
 * (`contacts.ts` was already 337 lines before this): a role is a tag in a
 * set, not an axis column, so the write shape below is genuinely different
 * from `PATCH /contacts/:id`'s per-field LWW — mixing the two conventions
 * into one handler would make both harder to read.
 *
 * ROUTE SHAPE — `role` is a JSON body field on BOTH routes below, never a
 * URL path segment or query parameter, including for removal:
 *
 *  A role is classification data exactly like `etat`/`ressenti` (VLT-03) —
 *  "this contact is tagged 'family'" says as much about the relationship as
 *  "ressenti is negative" does, which is why `contacts.ts`'s own routes
 *  never put an axis *value* in a URL either. What's different here is that
 *  a naive REST mapping (`DELETE /contacts/:id/roles/:role`) would put a
 *  role in a URL, and it turns out that's not just a style question:
 *  Fastify's default request logger (active here whenever `logger` isn't
 *  `false`, per `app.ts`) logs the full `req.url`, INCLUDING query strings,
 *  in its own "incoming request"/"request completed" lines — independent of
 *  anything a route handler explicitly logs. Confirmed while designing this
 *  route: a marker string placed in either a path segment or a `?query`
 *  parameter both surfaced verbatim in the captured log stream. So a role
 *  value is not safe in a URL at all, path or query, which rules out both
 *  `DELETE /contacts/:id/roles/:role` and a `?role=` query-string variant.
 *
 *  That leaves the body — but a body on `DELETE` is the same
 *  cross-HTTP-stack reliability risk `contacts.ts` already flagged for
 *  `mutationId` (the reason that moved to a header there in the first
 *  place). Rather than reintroduce that risk for the role value, removal is
 *  `POST /contacts/:id/roles/remove` — an explicit action route, not a
 *  `DELETE` — so both routes get a plain, reliable JSON body.
 *
 *  Both routes: `{ role }` in the body, `Idempotency-Key` header (VLT-07,
 *  same convention as `contacts.ts`), `requireAuth`.
 *
 * Outcomes → HTTP follow `contacts.ts`'s PATCH/DELETE mapping exactly:
 * `already_applied` → 200 with `contact: null` (VLT-03 — the ledger caches
 * no response body); `not_found` → 404 identically whether the contact
 * doesn't exist or isn't this caller's (IDT-08 — never a 403, which would
 * turn the id into an existence oracle); `applied`/`no_op` → 200 with the
 * current contact. 200, not 201, for `applied`: unlike `POST /contacts`,
 * there is no independently addressable "role resource" to point a
 * `Location` header at — a role is a fact about the existing contact.
 *
 * Logging (VLT-03/G3): ids and outcome only — never the role value, and
 * (unlike `patchContact`'s `stale: staleFields.length`) not even a count.
 * `patchContact` logs a count because several axes can change in one PATCH
 * and "how many" is genuinely useful without saying which. Here there is
 * exactly one role per call, so any per-call count/boolean would just be an
 * obfuscated "yes, a role changed" — no more informative than `outcome`
 * itself, which is already logged. Adding it would be a VLT-03 risk (an
 * attacker who can correlate call timing could start inferring which axis)
 * for zero operational benefit, so it's left out.
 */
const roleBodySchema = z.object({ role: z.enum(ROLE_VALUES) });
const paramsSchema = z.object({ id: rowIdSchema });

export interface ContactRoleRouteDeps {
  env: Env;
  repo: ContactsRepository & ContactRolesRepository;
}

export function registerContactRoleRoutes(app: FastifyInstance, deps: ContactRoleRouteDeps): void {
  const auth = requireAuth(deps.env);
  const { repo } = deps;

  app.post("/contacts/:id/roles", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");
    const mutationId = readMutationId(req, reply);
    if (mutationId === null) return reply;

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return sendProblem(reply, 404, "Contact not found");
    const parsed = roleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }

    const result = await repo.addRole(userId, mutationId, params.data.id, parsed.data.role);
    if (result.outcome === "already_applied") {
      req.log.info({ userId, contactId: params.data.id }, "contact role add replayed");
      return reply.code(200).send({ outcome: "already_applied", contact: null });
    }
    // "Not yours" and "does not exist" answer identically — otherwise the id
    // itself becomes an existence oracle for another user's data (IDT-08).
    if (result.outcome === "not_found") return sendProblem(reply, 404, "Contact not found");

    req.log.info(
      { userId, contactId: result.contact.id, outcome: result.outcome },
      "contact role added",
    );
    return reply.code(200).send({
      outcome: result.outcome,
      contact: serializeContact(result.contact),
      role: result.role,
    });
  });

  app.post("/contacts/:id/roles/remove", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");
    const mutationId = readMutationId(req, reply);
    if (mutationId === null) return reply;

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return sendProblem(reply, 404, "Contact not found");
    const parsed = roleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }

    const result = await repo.removeRole(userId, mutationId, params.data.id, parsed.data.role);
    if (result.outcome === "already_applied") {
      req.log.info({ userId, contactId: params.data.id }, "contact role remove replayed");
      return reply.code(200).send({ outcome: "already_applied", contact: null });
    }
    if (result.outcome === "not_found") return sendProblem(reply, 404, "Contact not found");

    req.log.info(
      { userId, contactId: result.contact.id, outcome: result.outcome },
      "contact role removed",
    );
    return reply.code(200).send({
      outcome: result.outcome,
      contact: serializeContact(result.contact),
    });
  });
}
