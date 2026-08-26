/**
 * Minimal persistence seam for the FS-07 walking skeleton.
 *
 * The app codes against this interface; production wires the Prisma
 * implementation (prisma-repo.ts) while route tests use an in-memory double
 * (tests/fake-repo.ts) so they run without a database. prisma-repo.ts itself
 * is covered separately by tests/prisma-repo.test.ts against real Postgres
 * (issue #22, G2 — Prisma is never mocked there); the in-memory double stays
 * for route-level tests, it was never meant to be replaced wholesale.
 *
 * ADR-001 stage 3 adds {@link ContactsRepository}. Its semantics (idempotency,
 * field-level LWW, tombstones) are behavioural, not just structural, so BOTH
 * implementations are held to one shared contract suite —
 * `tests/contacts-contract.ts`, run against the fake and against real Postgres.
 * The double cannot drift from Prisma without a red test.
 */
import type { SyncCursor } from "./contacts/cursor.js";
import type { Axis, EtatValue, RessentiValue, RoleContexteValue } from "./contacts/vocabulary.js";

export interface UserRecord {
  id: string;
  phoneHash: string;
  displayName: string;
}

export interface VaultRecord {
  userId: string;
  blob: Buffer;
  version: number;
  updatedAt: Date;
}

export type VaultWriteResult =
  | { ok: true; version: number }
  | { ok: false; currentVersion: number };

export interface IdentityRepository {
  findUserByPhoneHash(phoneHash: string): Promise<UserRecord | null>;
  /**
   * Race-safe (IDT-01): on concurrent creation of the same phoneHash (two
   * near-simultaneous first sign-ins), the losing call returns the existing
   * user instead of throwing a unique-violation.
   */
  createUser(phoneHash: string, displayName: string): Promise<UserRecord>;
}

/** DEPRECATED (ADR-001 stage 3) — superseded by {@link ContactsRepository}. Kept until stage 4 cuts the clients over. */
export interface VaultRepository {
  getVault(userId: string): Promise<VaultRecord | null>;
  /**
   * Optimistic concurrency (VLT-02): `baseVersion` is the version the client's
   * copy is based on (0 = first write). Mismatch → conflict with the current
   * version; success writes `baseVersion + 1`.
   */
  upsertVault(userId: string, blob: Buffer, baseVersion: number): Promise<VaultWriteResult>;
}

// ---------------------------------------------------------------------------
// Contact links + classification (ADR-001 stage 3 — VLT-02/07/08/09)
// ---------------------------------------------------------------------------

/** A single field write carrying the server timestamp the client last observed for it (VLT-09). */
export interface FieldWrite<T> {
  value: T;
  /** `null` = "I have never seen a server value for this field". */
  baseUpdatedAt: Date | null;
}

/** The owner's view of one contact. NEVER returned to anyone but `ownerId` (VLT-02, IDT-08). */
export interface ContactRecord {
  id: string;
  ownerId: string;
  targetId: string | null;
  invitedPhoneHash: string | null;
  displayName: string | null;
  ring: number | null;
  etat: EtatValue | null;
  ressenti: RessentiValue | null;
  /** Per-axis server timestamps — the LWW base a client echoes back on its next write. */
  fieldUpdatedAt: Record<Axis, Date | null>;
  lastAxisChangeAt: Date | null;
  stalenessSnoozedUntil: Date | null;
  createdAt: Date;
  /** Server-assigned on every write; the delta-pull cursor key (VLT-08). */
  updatedAt: Date;
  /** Tombstone (VLT-09) — a stale update can never resurrect the row. */
  deletedAt: Date | null;
}

export interface CreateContactInput {
  /** Exactly one of these two is set — enforced at the route AND by a DB CHECK. */
  targetId?: string;
  invitedPhoneHash?: string;
  displayName?: string;
  ring?: number;
  etat?: EtatValue;
  ressenti?: RessentiValue;
}

export type CreateContactResult =
  | { outcome: "created"; contact: ContactRecord }
  | { outcome: "already_applied" }
  /** A LIVE link to the same target / phone hash already exists (partial unique). */
  | { outcome: "duplicate" }
  | { outcome: "unknown_target" };

export type PatchContactInput = {
  [K in Axis]?: FieldWrite<ContactRecord[K]>;
};

export type PatchContactResult =
  /** `no_op` = processed and recorded, but nothing changed (every field stale, or the row is tombstoned). */
  | { outcome: "applied" | "no_op"; contact: ContactRecord; staleFields: Axis[] }
  | { outcome: "already_applied" }
  | { outcome: "not_found" };

export type DeleteContactResult =
  | { outcome: "applied" | "no_op"; contact: ContactRecord }
  | { outcome: "already_applied" }
  | { outcome: "not_found" };

export interface ContactPage {
  contacts: ContactRecord[];
  /** Keyset cursor of the last row in the page; `null` when the page is empty and no cursor was given. */
  nextCursor: SyncCursor | null;
  hasMore: boolean;
}

/**
 * Every method is scoped to `userId` — there is deliberately no "by id" read
 * that does not also filter on the owner (IDT-08).
 *
 * `mutationId` is the client-generated idempotency key (VLT-07). Implementations
 * MUST record it in the SAME transaction as the data write, so "applied" and
 * "recorded" can never disagree, and MUST answer a replay with `already_applied`
 * rather than re-executing. A `not_found` does NOT burn the id.
 */
export interface ContactsRepository {
  createContact(
    userId: string,
    mutationId: string,
    input: CreateContactInput,
  ): Promise<CreateContactResult>;
  patchContact(
    userId: string,
    mutationId: string,
    contactId: string,
    input: PatchContactInput,
  ): Promise<PatchContactResult>;
  deleteContact(
    userId: string,
    mutationId: string,
    contactId: string,
  ): Promise<DeleteContactResult>;
  /** Delta pull (VLT-08): rows strictly after `cursor` in `(updatedAt, id)` order, tombstones included. */
  listContactsSince(userId: string, cursor: SyncCursor | null, limit: number): Promise<ContactPage>;
}

// ---------------------------------------------------------------------------
// Rôles·contexte (ADR-001 stage 3 slice 2 — VLT-02/07/09)
// ---------------------------------------------------------------------------

export type AddRoleResult =
  | { outcome: "applied" | "no_op"; contact: ContactRecord; role: RoleContexteValue }
  | { outcome: "already_applied" }
  | { outcome: "not_found" };

export type RemoveRoleResult =
  | { outcome: "applied" | "no_op"; contact: ContactRecord }
  | { outcome: "already_applied" }
  | { outcome: "not_found" };

/**
 * Every method is scoped to `userId` — there is deliberately no "by id" read
 * that does not also filter on the owner (IDT-08). Restated from
 * {@link ContactsRepository}'s own doc comment so this interface stands on
 * its own for the next reader.
 *
 * `mutationId` is the client-generated idempotency key (VLT-07). Implementations
 * MUST record it in the SAME transaction as the data write, so "applied" and
 * "recorded" can never disagree, and MUST answer a replay with `already_applied`
 * rather than re-executing. A `not_found` does NOT burn the id.
 *
 * A role write MUST also bump the parent `ContactLink.updatedAt` in the same
 * transaction, so a client polling `listContactsSince` keeps seeing every
 * mutation to a contact it owns — including role-only changes — without a
 * separate roles-sync endpoint.
 */
export interface ContactRolesRepository {
  addRole(
    userId: string,
    mutationId: string,
    contactId: string,
    role: RoleContexteValue,
  ): Promise<AddRoleResult>;
  removeRole(
    userId: string,
    mutationId: string,
    contactId: string,
    role: RoleContexteValue,
  ): Promise<RemoveRoleResult>;
}

export interface Repository
  extends IdentityRepository,
    VaultRepository,
    ContactsRepository,
    ContactRolesRepository {}

export interface DbHealthResult {
  ok: boolean;
  latencyMs: number;
}

export type DbHealthCheck = () => Promise<DbHealthResult>;
