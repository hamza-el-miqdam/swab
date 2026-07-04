import { PrismaClient } from "@prisma/client";

// One PrismaClient per process; cached on globalThis so dev-mode reloads
// (tsx watch) don't leak connection pools.
const globalForPrisma = globalThis as unknown as { prismaSingleton?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prismaSingleton ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaSingleton = prisma;
}

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
}

/** Readiness probe for `GET /ready` (G3 / DAT rule 7): one round-trip, no table access. */
export async function dbHealth(): Promise<DbHealth> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - start) };
  }
}

// Re-export generated types and enums so consumers never import @prisma/client directly.
export * from "@prisma/client";
