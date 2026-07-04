/**
 * In-memory Repository double so route tests run WITHOUT a database.
 * Documented walking-skeleton exception to G2/backend rule 7: real Postgres
 * integration tests via Testcontainers replace DB-touching coverage next
 * sprint; Prisma is never mocked in those. Semantics mirror prisma-repo.ts
 * exactly (compare-and-swap on vault version).
 */
import type { Repository, UserRecord, VaultRecord, VaultWriteResult } from "../src/repo.js";

export interface FakeRepository extends Repository {
  /** keyed by phoneHash */
  users: Map<string, UserRecord>;
  /** keyed by userId */
  vaults: Map<string, VaultRecord>;
}

export function fakeRepository(): FakeRepository {
  const users = new Map<string, UserRecord>();
  const vaults = new Map<string, VaultRecord>();
  let seq = 0;

  return {
    users,
    vaults,

    async findUserByPhoneHash(phoneHash): Promise<UserRecord | null> {
      return users.get(phoneHash) ?? null;
    },

    async createUser(phoneHash, displayName): Promise<UserRecord> {
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
  };
}
