import { prisma } from "@repo/db";
import type { Repository, VaultWriteResult } from "./repo.js";

/**
 * Prisma-backed Repository. Read-only consumer of @repo/db — schema changes
 * go through area:db issues to the Data Steward.
 */
export function prismaRepository(): Repository {
  return {
    async findUserByPhoneHash(phoneHash) {
      const user = await prisma.user.findUnique({
        where: { phoneHash },
        select: { id: true, phoneHash: true, displayName: true },
      });
      return user;
    },

    async createUser(phoneHash, displayName) {
      return prisma.user.create({
        data: { phoneHash, displayName },
        select: { id: true, phoneHash: true, displayName: true },
      });
    },

    async getVault(userId) {
      const vault = await prisma.vault.findUnique({ where: { userId } });
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
          const created = await prisma.vault.create({
            data: { userId, blob, version: 1 },
            select: { version: true },
          });
          return { ok: true, version: created.version };
        } catch {
          // Unique violation: a vault already exists — report its version (VLT-02).
          const current = await prisma.vault.findUnique({
            where: { userId },
            select: { version: true },
          });
          return { ok: false, currentVersion: current?.version ?? 0 };
        }
      }
      // Compare-and-swap on version — the WHERE clause is the race arbiter.
      const updated = await prisma.vault.updateMany({
        where: { userId, version: baseVersion },
        data: { blob, version: baseVersion + 1 },
      });
      if (updated.count === 1) return { ok: true, version: baseVersion + 1 };
      const current = await prisma.vault.findUnique({
        where: { userId },
        select: { version: true },
      });
      return { ok: false, currentVersion: current?.version ?? 0 };
    },
  };
}
