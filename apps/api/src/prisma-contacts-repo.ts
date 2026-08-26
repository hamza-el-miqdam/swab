import {
  $Enums,
  isForeignKeyViolation,
  isUniqueViolation,
  Prisma,
  prisma,
  type PrismaClient,
} from "@repo/db";
import type {
  AddRoleResult,
  ContactPage,
  ContactRecord,
  ContactRolesRepository,
  ContactsRepository,
  CreateContactInput,
  CreateContactResult,
  DeleteContactResult,
  PatchContactResult,
  RemoveRoleResult,
} from "./repo.js";
import type { SyncCursor } from "./contacts/cursor.js";
import { pageFrom } from "./contacts/page.js";
import {
  AXES,
  STALENESS_AXES,
  type Axis,
  type EtatValue,
  type RessentiValue,
  type RoleContexteValue,
} from "./contacts/vocabulary.js";

/** Prisma's transaction-scoped client — no `$transaction`/`$connect` on it. */
type Tx = Omit<PrismaClient, `$${string}`>;

/**
 * The FCH-09 identifiers travel on the wire and are what Postgres stores
 * (`@map`); Prisma's TypeScript members are SCREAMING_CASE. Translating in
 * exactly one place keeps the domain layer (`src/contacts/`, `src/repo.ts`)
 * framework-agnostic — the AWS lift must not touch domain code.
 */
const ETAT_TO_DB: Record<EtatValue, $Enums.Etat> = {
  available: $Enums.Etat.AVAILABLE,
  busy: $Enums.Etat.BUSY,
  away: $Enums.Etat.AWAY,
  paused: $Enums.Etat.PAUSED,
};
const RESSENTI_TO_DB: Record<RessentiValue, $Enums.Ressenti> = {
  positive: $Enums.Ressenti.POSITIVE,
  ambivalent: $Enums.Ressenti.AMBIVALENT,
  negative: $Enums.Ressenti.NEGATIVE,
};
/**
 * Rôles·contexte (ADR-001 stage 3 slice 2) — same wire/DB translation pattern
 * as `ETAT_TO_DB`/`RESSENTI_TO_DB` above, deliberately kept separate rather
 * than folded into `toDbValue`: roles are a set of tags on `ContactRole`, not
 * an axis column on `ContactLink` (see `ContactRolesRepository`'s doc comment).
 */
const ROLE_TO_DB: Record<RoleContexteValue, $Enums.RoleContexte> = {
  family: $Enums.RoleContexte.FAMILY,
  partner: $Enums.RoleContexte.PARTNER,
  colleague: $Enums.RoleContexte.COLLEAGUE,
  cohort: $Enums.RoleContexte.COHORT,
  community: $Enums.RoleContexte.COMMUNITY,
  neighbor: $Enums.RoleContexte.NEIGHBOR,
};
const ETAT_FROM_DB = invert(ETAT_TO_DB);
const RESSENTI_FROM_DB = invert(RESSENTI_TO_DB);

function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;
}

/** Column holding each axis's own LWW timestamp. */
const FIELD_TS = {
  displayName: "displayNameUpdatedAt",
  ring: "ringUpdatedAt",
  etat: "etatUpdatedAt",
  ressenti: "ressentiUpdatedAt",
} as const satisfies Record<Axis, string>;

type ContactRow = Prisma.ContactLinkGetPayload<Record<string, never>>;

function toRecord(row: ContactRow): ContactRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    targetId: row.targetId,
    invitedPhoneHash: row.invitedPhoneHash,
    displayName: row.displayName,
    ring: row.ring,
    etat: row.etat === null ? null : ETAT_FROM_DB[row.etat],
    ressenti: row.ressenti === null ? null : RESSENTI_FROM_DB[row.ressenti],
    fieldUpdatedAt: {
      displayName: row.displayNameUpdatedAt,
      ring: row.ringUpdatedAt,
      etat: row.etatUpdatedAt,
      ressenti: row.ressentiUpdatedAt,
    },
    lastAxisChangeAt: row.lastAxisChangeAt,
    stalenessSnoozedUntil: row.stalenessSnoozedUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Thrown inside the transaction to roll the ledger row back — see `runMutation`. */
class MutationAbort extends Error {
  constructor(readonly reason: "not_found") {
    super(reason);
  }
}

/**
 * VLT-07. Runs `work` with its idempotency-ledger row in the SAME transaction,
 * so "applied" and "recorded" cannot disagree in either direction:
 *
 *  - the ledger insert is the FIRST statement, and its composite PK
 *    `(user_id, id)` is the race arbiter for two concurrent replays;
 *  - Postgres aborts a transaction on any error, so a duplicate id rolls the
 *    data write back with it — a replay can never half-apply;
 *  - a `MutationAbort` likewise rolls the ledger row back, so a mutation the
 *    server refused to process does not burn the client's id.
 *
 * The ledger caches no response body on purpose (schema.prisma): storing one
 * would put classification data in a second, unaudited table (VLT-03). A replay
 * is answered "already applied" and the client re-pulls by cursor.
 */
async function runMutation<T>(
  client: PrismaClient,
  userId: string,
  mutationId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T | "already_applied" | "not_found"> {
  // Cheap PK read first: a replay is common (that is the point of the outbox)
  // and this avoids doing the whole write just to roll it back.
  const seen = await client.clientMutation.findUnique({
    where: { userId_id: { userId, id: mutationId } },
    select: { id: true },
  });
  if (seen !== null) return "already_applied";

  try {
    return await client.$transaction(async (tx) => {
      await tx.clientMutation.create({ data: { userId, id: mutationId } });
      return await work(tx);
    });
  } catch (err) {
    if (err instanceof MutationAbort) return err.reason;
    if (!isUniqueViolation(err)) throw err;
    // A P2002 could have come from the ledger insert OR from a data write
    // (the live-edge partial uniques). Rather than matching on constraint
    // names, re-read the ledger: the row survives only if a concurrent replay
    // of this same id committed. Anything else is a real data conflict and
    // must reach the caller.
    const recorded = await client.clientMutation.findUnique({
      where: { userId_id: { userId, id: mutationId } },
      select: { id: true },
    });
    if (recorded !== null) return "already_applied";
    throw err;
  }
}

/**
 * Prisma-backed `ContactsRepository` + `ContactRolesRepository` (ADR-001
 * stage 3, slice 2 adds roles). Read-only consumer of `@repo/db` — schema
 * changes go through an `area:db` issue.
 *
 * Every query filters on `ownerId`; there is deliberately no lookup by contact
 * id alone, so no code path can serve one user another user's classification
 * (VLT-02, IDT-08). Nothing here logs — the routes log ids and counts only.
 */
export function prismaContactsRepository(
  client: PrismaClient = prisma,
): ContactsRepository & ContactRolesRepository {
  return {
    async createContact(userId, mutationId, input): Promise<CreateContactResult> {
      try {
        const result = await runMutation(client, userId, mutationId, async (tx) => {
          const stamp = new Date();
          const row = await tx.contactLink.create({
            data: {
              ownerId: userId,
              targetId: input.targetId ?? null,
              invitedPhoneHash: input.invitedPhoneHash ?? null,
              ...axisCreateData(input, stamp),
              lastAxisChangeAt: STALENESS_AXES.some((axis) => input[axis] !== undefined)
                ? stamp
                : null,
              updatedAt: stamp,
            },
          });
          return { outcome: "created" as const, contact: toRecord(row) };
        });
        // `not_found` is unreachable here — createContact never aborts — but the
        // union is shared, so narrow rather than cast.
        if (result === "not_found") throw new Error("unreachable");
        return result === "already_applied" ? { outcome: "already_applied" } : result;
      } catch (err) {
        // A LIVE link to this target / phone hash already exists. Tombstoned
        // rows are exempt (partial unique), so re-adding after a delete works.
        if (isUniqueViolation(err)) return { outcome: "duplicate" };
        // `target_id` references a user that does not exist.
        if (isForeignKeyViolation(err)) return { outcome: "unknown_target" };
        throw err;
      }
    },

    async patchContact(userId, mutationId, contactId, input): Promise<PatchContactResult> {
      const result = await runMutation(client, userId, mutationId, async (tx) => {
        const existing = await tx.contactLink.findFirst({
          where: { id: contactId, ownerId: userId },
        });
        if (existing === null) throw new MutationAbort("not_found");
        if (existing.deletedAt !== null) {
          // Tombstoned: the mutation is recorded (so the outbox stops retrying)
          // but nothing is written — a stale device cannot resurrect the row
          // (VLT-09). Never partially applied.
          return { outcome: "no_op" as const, contact: toRecord(existing), staleFields: [] };
        }

        // ONE server-assigned instant for the whole mutation (VLT-08), so the
        // record cursor and every field timestamp it writes stay consistent.
        const stamp = new Date();
        const staleFields: Axis[] = [];
        let applied = false;
        let axisApplied = false;

        for (const axis of AXES) {
          const write = input[axis];
          if (write === undefined) continue;
          // Field-level compare-and-swap: the base timestamp goes in the WHERE
          // clause, so the check and the write are one atomic statement — two
          // concurrent devices cannot both read-then-clobber.
          const { count } = await tx.contactLink.updateMany({
            where: {
              id: contactId,
              ownerId: userId,
              deletedAt: null,
              [FIELD_TS[axis]]: write.baseUpdatedAt,
            },
            data: { [axis]: toDbValue(axis, write.value), [FIELD_TS[axis]]: stamp, updatedAt: stamp },
          });
          if (count === 0) {
            staleFields.push(axis);
            continue;
          }
          applied = true;
          if (STALENESS_AXES.includes(axis)) axisApplied = true;
        }

        if (axisApplied) {
          // FCH-05 staleness timer — server-owned, never client-written, so it
          // survives a device change. A rename is not a re-look.
          await tx.contactLink.updateMany({
            where: { id: contactId, ownerId: userId },
            data: { lastAxisChangeAt: stamp, updatedAt: stamp },
          });
        }
        const after = await tx.contactLink.findFirstOrThrow({
          where: { id: contactId, ownerId: userId },
        });
        return {
          outcome: applied ? ("applied" as const) : ("no_op" as const),
          contact: toRecord(after),
          staleFields,
        };
      });
      if (result === "already_applied") return { outcome: "already_applied" };
      if (result === "not_found") return { outcome: "not_found" };
      return result;
    },

    async deleteContact(userId, mutationId, contactId): Promise<DeleteContactResult> {
      const result = await runMutation(client, userId, mutationId, async (tx) => {
        const existing = await tx.contactLink.findFirst({
          where: { id: contactId, ownerId: userId },
        });
        if (existing === null) throw new MutationAbort("not_found");
        if (existing.deletedAt !== null) {
          return { outcome: "no_op" as const, contact: toRecord(existing) };
        }
        const stamp = new Date();
        // Tombstone, never a hard delete (VLT-09). The classification columns
        // are left in place: purging them is a retention-sweep concern, not a
        // sync one, and inventing a purge policy here would be guessing.
        await tx.contactLink.updateMany({
          where: { id: contactId, ownerId: userId, deletedAt: null },
          data: { deletedAt: stamp, updatedAt: stamp },
        });
        const after = await tx.contactLink.findFirstOrThrow({
          where: { id: contactId, ownerId: userId },
        });
        return { outcome: "applied" as const, contact: toRecord(after) };
      });
      if (result === "already_applied") return { outcome: "already_applied" };
      if (result === "not_found") return { outcome: "not_found" };
      return result;
    },

    async listContactsSince(userId, cursor, limit): Promise<ContactPage> {
      // Served by `@@index([ownerId, updatedAt])`; the id tie-break is a tiny
      // in-memory sort inside one millisecond. See `contacts/cursor.ts` for why
      // the default predicate is INCLUSIVE of the cursor's millisecond.
      const rows = await client.contactLink.findMany({
        where: { ownerId: userId, ...contactCursorFilter(cursor) },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: limit + 1, // one extra row is the hasMore probe
      });
      return pageFrom(rows.map(toRecord), cursor, limit);
    },

    // --- Rôles·contexte (ADR-001 stage 3 slice 2) ----------------------------

    async addRole(userId, mutationId, contactId, role): Promise<AddRoleResult> {
      const result = await runMutation(client, userId, mutationId, async (tx) => {
        const existing = await tx.contactLink.findFirst({
          where: { id: contactId, ownerId: userId },
        });
        // A tombstoned parent is treated the same as a missing one — a role
        // can never outlive the contact it hangs off (VLT-09).
        if (existing === null || existing.deletedAt !== null) throw new MutationAbort("not_found");

        const dbRole = ROLE_TO_DB[role];
        // Check-first, NOT create-then-catch-P2002: Postgres aborts the WHOLE
        // transaction on any statement error (25P02, "current transaction is
        // aborted"), unlike `createContact`, which lets its unique violation
        // escape the transaction (and `runMutation`) entirely rather than
        // catching it and issuing more queries on the same `tx`. Reading the
        // row first keeps every statement in this transaction error-free.
        const roleRow = await tx.contactRole.findUnique({
          where: { contactLinkId_role: { contactLinkId: contactId, role: dbRole } },
        });
        if (roleRow !== null && roleRow.deletedAt === null) {
          // Already live — domain-level no-op, distinct from the mutation-id
          // idempotency `runMutation` already handled (VLT-07 vs. a genuinely
          // repeated intent).
          return { outcome: "no_op" as const, contact: toRecord(existing), role };
        }
        if (roleRow !== null) {
          // Previously tombstoned — revive rather than insert (mirrors the
          // partial-unique "re-add after delete" shape on ContactLink itself).
          await tx.contactRole.update({
            where: { contactLinkId_role: { contactLinkId: contactId, role: dbRole } },
            data: { deletedAt: null },
          });
        } else {
          await tx.contactRole.create({ data: { contactLinkId: contactId, role: dbRole } });
        }
        // Bump the parent so the cursor pull covers this change too — see
        // `ContactRolesRepository`'s doc comment in repo.ts.
        const stamp = new Date();
        await tx.contactLink.updateMany({
          where: { id: contactId, ownerId: userId },
          data: { updatedAt: stamp },
        });
        const after = await tx.contactLink.findFirstOrThrow({
          where: { id: contactId, ownerId: userId },
        });
        return { outcome: "applied" as const, contact: toRecord(after), role };
      });
      if (result === "already_applied") return { outcome: "already_applied" };
      if (result === "not_found") return { outcome: "not_found" };
      return result;
    },

    async removeRole(userId, mutationId, contactId, role): Promise<RemoveRoleResult> {
      const result = await runMutation(client, userId, mutationId, async (tx) => {
        const existing = await tx.contactLink.findFirst({
          where: { id: contactId, ownerId: userId },
        });
        if (existing === null || existing.deletedAt !== null) throw new MutationAbort("not_found");

        const dbRole = ROLE_TO_DB[role];
        const roleRow = await tx.contactRole.findUnique({
          where: { contactLinkId_role: { contactLinkId: contactId, role: dbRole } },
        });
        if (roleRow === null || roleRow.deletedAt !== null) {
          // Never lived, or already tombstoned — recorded, nothing to write
          // (mirrors deleteContact's tombstone-of-a-tombstone no_op).
          return { outcome: "no_op" as const, contact: toRecord(existing) };
        }
        const stamp = new Date();
        await tx.contactRole.update({
          where: { contactLinkId_role: { contactLinkId: contactId, role: dbRole } },
          data: { deletedAt: stamp },
        });
        await tx.contactLink.updateMany({
          where: { id: contactId, ownerId: userId },
          data: { updatedAt: stamp },
        });
        const after = await tx.contactLink.findFirstOrThrow({
          where: { id: contactId, ownerId: userId },
        });
        return { outcome: "applied" as const, contact: toRecord(after) };
      });
      if (result === "already_applied") return { outcome: "already_applied" };
      if (result === "not_found") return { outcome: "not_found" };
      return result;
    },
  };
}

/** Cursor → Prisma predicate. See `contacts/cursor.ts` for the two modes. */
function contactCursorFilter(cursor: SyncCursor | null): Prisma.ContactLinkWhereInput {
  if (cursor === null) return {};
  if (cursor.afterId === null) return { updatedAt: { gte: cursor.updatedAt } };
  return {
    OR: [
      { updatedAt: { gt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { gt: cursor.afterId } },
    ],
  };
}

function toDbValue(axis: Axis, value: string | number | null): unknown {
  if (value === null) return null;
  if (axis === "etat") return ETAT_TO_DB[value as EtatValue];
  if (axis === "ressenti") return RESSENTI_TO_DB[value as RessentiValue];
  return value;
}

/** Only the axis columns; the caller supplies ownership, timestamps and the tombstone. */
type AxisCreateData = Pick<
  Prisma.ContactLinkUncheckedCreateInput,
  | "displayName"
  | "ring"
  | "etat"
  | "ressenti"
  | "displayNameUpdatedAt"
  | "ringUpdatedAt"
  | "etatUpdatedAt"
  | "ressentiUpdatedAt"
>;

/**
 * Written out per axis rather than looped: `exactOptionalPropertyTypes` makes a
 * dynamically-keyed object un-narrowable, and an axis added without its
 * `*UpdatedAt` twin would break LWW silently. Here the pairing is visible.
 */
function axisCreateData(input: CreateContactInput, stamp: Date): AxisCreateData {
  return {
    ...(input.displayName === undefined
      ? {}
      : { displayName: input.displayName, displayNameUpdatedAt: stamp }),
    ...(input.ring === undefined ? {} : { ring: input.ring, ringUpdatedAt: stamp }),
    ...(input.etat === undefined ? {} : { etat: ETAT_TO_DB[input.etat], etatUpdatedAt: stamp }),
    ...(input.ressenti === undefined
      ? {}
      : { ressenti: RESSENTI_TO_DB[input.ressenti], ressentiUpdatedAt: stamp }),
  };
}
