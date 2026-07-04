/**
 * Minimal persistence seam for the FS-07 walking skeleton.
 *
 * The app codes against this interface; production wires the Prisma
 * implementation (prisma-repo.ts) while tests use an in-memory double so they
 * run without a database. NOTE (backend rule 7 / G2): this is a temporary,
 * documented exception — Testcontainers Postgres integration tests replace the
 * in-memory double next sprint, and Prisma is never mocked in those.
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
