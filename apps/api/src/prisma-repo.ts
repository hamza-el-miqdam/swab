import { Prisma, prisma, type PrismaClient } from "@repo/db";
import { prismaContactsRepository } from "./prisma-contacts-repo.js";
import type { Repository, VaultWriteResult } from "./repo.js";

/**
 * Prisma-backed Repository. Read-only consumer of @repo/db — schema changes
 * go through area:db issues to the Data Steward.
 *
 * `client` defaults to the shared singleton; SUG-API-003's unit tests inject
 * a stub to exercise upsertVault's error-mapping branches without a real
 * Postgres (tests/prisma-repo-error-mapping.test.ts) — the real CAS/create
 * semantics stay real-Postgres-only in tests/prisma-repo.test.ts.
 */
export function prismaRepository(client: PrismaClient = prisma): Repository {
  return {
    // ADR-001 stage 3 — contact links + classification. Kept in its own module:
    // it is the only part of the repository that runs transactions, and mixing
    // it in here would have buried the VLT-07/08/09 reasoning under the
    // deprecated vault code below.
    ...prismaContactsRepository(client),

    async findUserByPhoneHash(phoneHash) {
      const user = await client.user.findUnique({
        where: { phoneHash },
        select: { id: true, phoneHash: true, displayName: true },
      });
      return user;
    },

    async createUser(phoneHash, displayName) {
      try {
        return await client.user.create({
          data: { phoneHash, displayName },
          select: { id: true, phoneHash: true, displayName: true },
        });
      } catch (err) {
        // Only a unique violation on phoneHash means "this user already
        // exists" (IDT-01) — two near-simultaneous first sign-ins (double-tap,
        // client retry, two devices) both pass findUserByPhoneHash → null,
        // then race here; anything else must not be swallowed into a false
        // "existing user", so it rethrows to the global error handler (500).
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
          throw err;
        }
        const existing = await client.user.findUnique({
          where: { phoneHash },
          select: { id: true, phoneHash: true, displayName: true },
        });
        // The row that caused the unique violation vanished before this
        // read — self-contradictory state, surface it rather than fabricate.
        if (existing === null) throw err;
        return existing; // loser of the race signs in as the existing user
      }
    },

    async getVault(userId) {
      const vault = await client.vault.findUnique({ where: { userId } });
      if (vault === null) return null;
      return {
        userId: vault.userId,
        blob: Buffer.from(vault.blob),
        version: vault.version,
        updatedAt: vault.updatedAt,
      };
    },

    async upsertVault(userId, blob, baseVersion): Promise<VaultWriteResult> {
      if (baseVersion === 0) {
        try {
          const created = await client.vault.create({
            data: { userId, blob, version: 1 },
            select: { version: true },
          });
          return { ok: true, version: created.version };
        } catch (err) {
          // Only a unique violation means "a vault already exists" (VLT-02) —
          // anything else (dropped connection, pool timeout, ...) must not be
          // swallowed into a false 409, or the client loops retrying forever
          // against a transient infra failure. Rethrow → global error handler
          // logs it and returns 500 (app.ts).
          if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
            throw err;
          }
          const current = await client.vault.findUnique({
            where: { userId },
            select: { version: true },
          });
          // The row that caused the unique violation vanished before this
          // read — self-contradictory state, surface it rather than report a
          // fabricated "conflict with version 0".
          if (current === null) throw err;
          return { ok: false, currentVersion: current.version };
        }
      }
      // Compare-and-swap on version — the WHERE clause is the race arbiter.
      const updated = await client.vault.updateMany({
        where: { userId, version: baseVersion },
        data: { blob, version: baseVersion + 1 },
      });
      if (updated.count === 1) return { ok: true, version: baseVersion + 1 };
      const current = await client.vault.findUnique({
        where: { userId },
        select: { version: true },
      });
      // Unlike the first-write branch, baseVersion > 0 against no row is a
      // legitimate client-protocol state (their local copy is stale/wrong) —
      // 0 correctly means "you have no vault; retry with version 0".
      return { ok: false, currentVersion: current?.version ?? 0 };
    },
  };
}
