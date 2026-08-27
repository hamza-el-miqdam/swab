/**
 * In-memory Repository double so route tests run WITHOUT a database.
 * `prisma-repo.test.ts` covers `prisma-repo.ts` itself against real Postgres
 * (issue #22, G2 — Prisma is never mocked there); this double stays for
 * route-level tests. Semantics mirror prisma-repo.ts exactly (compare-and-swap
 * on vault version).
 *
 * The contacts half (ADR-001 stage 3) is held to the SAME behavioural suite as
 * the Prisma implementation — `contacts-contract.ts`, run from both
 * `contacts-repo.fake.test.ts` and `contacts-repo.postgres.test.ts`. If this
 * double's idempotency / LWW / tombstone semantics drift, that suite goes red
 * before any route test can quietly start lying.
 *
 * The roles half (ADR-001 stage 3 slice 2) is held to the same discipline via
 * `contact-roles-contract.ts`.
 */
import { AXES, STALENESS_AXES, type Axis, type RoleContexteValue } from "../src/contacts/vocabulary.js";
import { pageFrom } from "../src/contacts/page.js";
import type {
  AddRoleResult,
  ContactPage,
  ContactRecord,
  CreateContactInput,
  CreateContactResult,
  DeleteContactResult,
  PatchContactInput,
  PatchContactResult,
  RemoveRoleResult,
  Repository,
  UserRecord,
  VaultRecord,
  VaultWriteResult,
} from "../src/repo.js";

export interface FakeRepository extends Repository {
  /** keyed by phoneHash */
  users: Map<string, UserRecord>;
  /** keyed by userId */
  vaults: Map<string, VaultRecord>;
}

export function fakeRepository(): FakeRepository {
  const users = new Map<string, UserRecord>();
  const vaults = new Map<string, VaultRecord>();
  /** keyed by contact id */
  const contacts = new Map<string, ContactRecord>();
  /** VLT-07 ledger, keyed `${userId}|${mutationId}` — scoped per user like the real PK. */
  const mutations = new Set<string>();
  /** Mirrors the composite PK `@@id([contactLinkId, role])`, keyed `${contactId}|${role}`. */
  interface RoleRow {
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }
  const roles = new Map<string, RoleRow>();
  let seq = 0;

  const ledgerKey = (userId: string, mutationId: string): string => `${userId}|${mutationId}`;
  const roleKey = (contactId: string, role: RoleContexteValue): string => `${contactId}|${role}`;

  /**
   * Live role tags for one contact, alphabetical (issue #153 — see
   * `ContactRecord.roles`'s doc comment in repo.ts for why alphabetical).
   * Computed fresh from the `roles` map rather than stored on the contact
   * itself, so `addRole`/`removeRole` never have to keep two copies in sync.
   */
  const liveRolesFor = (contactId: string): RoleContexteValue[] =>
    [...roles.entries()]
      .filter(([key, row]) => key.startsWith(`${contactId}|`) && row.deletedAt === null)
      .map(([key]) => key.slice(contactId.length + 1) as RoleContexteValue)
      .sort();

  const clone = (contact: ContactRecord): ContactRecord => ({
    ...contact,
    fieldUpdatedAt: { ...contact.fieldUpdatedAt },
    roles: liveRolesFor(contact.id),
  });

  const own = (userId: string, contactId: string): ContactRecord | null => {
    const found = contacts.get(contactId);
    // Ownership is part of the lookup, never a separate check — "not yours"
    // and "does not exist" must be indistinguishable (IDT-08).
    return found !== undefined && found.ownerId === userId ? found : null;
  };

  return {
    users,
    vaults,

    async findUserByPhoneHash(phoneHash): Promise<UserRecord | null> {
      return users.get(phoneHash) ?? null;
    },

    async createUser(phoneHash, displayName): Promise<UserRecord> {
      // Race-safe like prisma-repo.ts's P2002 handling (SUG-API-004): a
      // concurrent second create for the same phoneHash returns the winner
      // instead of silently overwriting it.
      const existing = users.get(phoneHash);
      if (existing !== undefined) return existing;
      seq += 1;
      const user: UserRecord = { id: `user_${seq}`, phoneHash, displayName };
      users.set(phoneHash, user);
      return user;
    },

    async getVault(userId): Promise<VaultRecord | null> {
      return vaults.get(userId) ?? null;
    },

    async upsertVault(userId, blob, baseVersion): Promise<VaultWriteResult> {
      const currentVersion = vaults.get(userId)?.version ?? 0;
      if (baseVersion !== currentVersion) return { ok: false, currentVersion };
      const next: VaultRecord = { userId, blob, version: currentVersion + 1, updatedAt: new Date() };
      vaults.set(userId, next);
      return { ok: true, version: next.version };
    },

    // --- Contacts (ADR-001 stage 3) ------------------------------------------

    async createContact(
      userId: string,
      mutationId: string,
      input: CreateContactInput,
    ): Promise<CreateContactResult> {
      if (mutations.has(ledgerKey(userId, mutationId))) return { outcome: "already_applied" };
      if (input.targetId !== undefined && ![...users.values()].some((u) => u.id === input.targetId)) {
        return { outcome: "unknown_target" }; // the FK does this in Postgres
      }
      // Mirrors the two PARTIAL unique indexes: only LIVE rows collide, so a
      // deleted contact can be re-added (20260817000000 / 20260818000000).
      const collides = [...contacts.values()].some(
        (c) =>
          c.ownerId === userId &&
          c.deletedAt === null &&
          ((input.targetId !== undefined && c.targetId === input.targetId) ||
            (input.invitedPhoneHash !== undefined &&
              c.invitedPhoneHash === input.invitedPhoneHash)),
      );
      if (collides) return { outcome: "duplicate" };

      seq += 1;
      const stamp = new Date();
      const contact: ContactRecord = {
        id: `contact_${seq}`,
        ownerId: userId,
        targetId: input.targetId ?? null,
        invitedPhoneHash: input.invitedPhoneHash ?? null,
        displayName: input.displayName ?? null,
        ring: input.ring ?? null,
        etat: input.etat ?? null,
        ressenti: input.ressenti ?? null,
        roles: [], // overridden by `clone`'s `liveRolesFor` on every return anyway
        fieldUpdatedAt: {
          displayName: input.displayName === undefined ? null : stamp,
          ring: input.ring === undefined ? null : stamp,
          etat: input.etat === undefined ? null : stamp,
          ressenti: input.ressenti === undefined ? null : stamp,
        },
        lastAxisChangeAt: STALENESS_AXES.some((a) => input[a] !== undefined) ? stamp : null,
        stalenessSnoozedUntil: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      };
      contacts.set(contact.id, contact);
      mutations.add(ledgerKey(userId, mutationId));
      return { outcome: "created", contact: clone(contact) };
    },

    async patchContact(
      userId: string,
      mutationId: string,
      contactId: string,
      input: PatchContactInput,
    ): Promise<PatchContactResult> {
      if (mutations.has(ledgerKey(userId, mutationId))) return { outcome: "already_applied" };
      const existing = own(userId, contactId);
      // Checked BEFORE the ledger write: a not_found never burns the id.
      if (existing === null) return { outcome: "not_found" };
      mutations.add(ledgerKey(userId, mutationId));
      if (existing.deletedAt !== null) {
        // Tombstoned: the whole mutation is dropped, never partially applied
        // (VLT-09 — no resurrection).
        return { outcome: "no_op", contact: clone(existing), staleFields: [] };
      }

      const stamp = new Date();
      const staleFields: Axis[] = [];
      let applied = false;
      let axisApplied = false;
      for (const axis of AXES) {
        const write = input[axis];
        if (write === undefined) continue;
        // Field-level compare-and-swap on the server timestamp the client last
        // saw. Anything but an exact match means the column moved on and the
        // stored value wins (VLT-09).
        const stored = existing.fieldUpdatedAt[axis];
        const base = write.baseUpdatedAt;
        if ((stored?.getTime() ?? null) !== (base?.getTime() ?? null)) {
          staleFields.push(axis);
          continue;
        }
        Object.assign(existing, { [axis]: write.value });
        existing.fieldUpdatedAt[axis] = stamp;
        existing.updatedAt = stamp;
        applied = true;
        if (STALENESS_AXES.includes(axis)) axisApplied = true;
      }
      if (axisApplied) existing.lastAxisChangeAt = stamp; // FCH-05
      return { outcome: applied ? "applied" : "no_op", contact: clone(existing), staleFields };
    },

    async deleteContact(
      userId: string,
      mutationId: string,
      contactId: string,
    ): Promise<DeleteContactResult> {
      if (mutations.has(ledgerKey(userId, mutationId))) return { outcome: "already_applied" };
      const existing = own(userId, contactId);
      if (existing === null) return { outcome: "not_found" };
      mutations.add(ledgerKey(userId, mutationId));
      if (existing.deletedAt !== null) return { outcome: "no_op", contact: clone(existing) };
      const stamp = new Date();
      existing.deletedAt = stamp;
      existing.updatedAt = stamp;
      return { outcome: "applied", contact: clone(existing) };
    },

    async listContactsSince(userId, cursor, limit): Promise<ContactPage> {
      const matches = [...contacts.values()]
        .filter((c) => c.ownerId === userId)
        .filter((c) => {
          if (cursor === null) return true;
          const at = c.updatedAt.getTime();
          const since = cursor.updatedAt.getTime();
          // Same two modes as `contactCursorFilter` in prisma-contacts-repo.ts.
          return cursor.afterId === null
            ? at >= since
            : at > since || (at === since && c.id > cursor.afterId);
        })
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || (a.id < b.id ? -1 : 1));

      // Same `limit + 1` probe as Prisma, then the SHARED paging tail — the two
      // must agree on when an id-bearing cursor is emitted.
      return pageFrom(matches.slice(0, limit + 1).map(clone), cursor, limit);
    },

    // --- Rôles·contexte (ADR-001 stage 3 slice 2) -----------------------------

    async addRole(
      userId: string,
      mutationId: string,
      contactId: string,
      role: RoleContexteValue,
    ): Promise<AddRoleResult> {
      if (mutations.has(ledgerKey(userId, mutationId))) return { outcome: "already_applied" };
      const existing = own(userId, contactId);
      // Checked BEFORE the ledger write: a not_found never burns the id. A
      // tombstoned parent contact is treated the same as a missing one — a
      // role can never outlive the contact it hangs off.
      if (existing === null || existing.deletedAt !== null) return { outcome: "not_found" };
      mutations.add(ledgerKey(userId, mutationId));

      const key = roleKey(contactId, role);
      const row = roles.get(key);
      const stamp = new Date();
      if (row !== undefined && row.deletedAt === null) {
        // Already live — no-op at the domain level, distinct from the
        // mutation-id idempotency above (VLT-07 vs. a genuinely repeated intent).
        return { outcome: "no_op", contact: clone(existing), role };
      }
      if (row !== undefined) {
        // Previously tombstoned: revive rather than insert (mirrors the
        // partial-unique "re-add after delete" shape on ContactLink itself).
        row.deletedAt = null;
        row.updatedAt = stamp;
      } else {
        roles.set(key, { createdAt: stamp, updatedAt: stamp, deletedAt: null });
      }
      // Bump the parent so the cursor pull covers this change too.
      existing.updatedAt = stamp;
      return { outcome: "applied", contact: clone(existing), role };
    },

    async removeRole(
      userId: string,
      mutationId: string,
      contactId: string,
      role: RoleContexteValue,
    ): Promise<RemoveRoleResult> {
      if (mutations.has(ledgerKey(userId, mutationId))) return { outcome: "already_applied" };
      const existing = own(userId, contactId);
      if (existing === null || existing.deletedAt !== null) return { outcome: "not_found" };
      mutations.add(ledgerKey(userId, mutationId));

      const key = roleKey(contactId, role);
      const row = roles.get(key);
      if (row === undefined || row.deletedAt !== null) {
        // Never lived, or already tombstoned — recorded, nothing to write
        // (mirrors deleteContact's tombstone-of-a-tombstone no_op).
        return { outcome: "no_op", contact: clone(existing) };
      }
      const stamp = new Date();
      row.deletedAt = stamp;
      row.updatedAt = stamp;
      existing.updatedAt = stamp;
      return { outcome: "applied", contact: clone(existing) };
    },
  };
}
