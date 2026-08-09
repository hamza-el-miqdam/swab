/**
 * Minimal persistence seam for the FS-07 walking skeleton.
 *
 * The app codes against this interface; production wires the Prisma
 * implementation (prisma-repo.ts) while route tests use an in-memory double
 * (tests/fake-repo.ts) so they run without a database. prisma-repo.ts itself
 * is covered separately by tests/prisma-repo.test.ts against real Postgres
 * (issue #22, G2 — Prisma is never mocked there); the in-memory double stays
 * for route-level tests, it was never meant to be replaced wholesale.
 */

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

export interface Repository {
  findUserByPhoneHash(phoneHash: string): Promise<UserRecord | null>;
  createUser(phoneHash: string, displayName: string): Promise<UserRecord>;
  getVault(userId: string): Promise<VaultRecord | null>;
  /**
   * Optimistic concurrency (VLT-02): `baseVersion` is the version the client's
   * copy is based on (0 = first write). Mismatch → conflict with the current
   * version; success writes `baseVersion + 1`.
   */
  upsertVault(userId: string, blob: Buffer, baseVersion: number): Promise<VaultWriteResult>;
}

export interface DbHealthResult {
  ok: boolean;
  latencyMs: number;
}

export type DbHealthCheck = () => Promise<DbHealthResult>;
