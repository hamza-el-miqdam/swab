import { Prisma, PrismaClient } from "@prisma/client";

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

/**
 * True iff `err` is a unique-constraint violation raised through Prisma's ORM
 * layer (P2002 — a `create`/`update`/`upsert` write). SUG-DB-011: a bare
 * `catch {}` around a `create()` cannot tell a true "row already exists"
 * apart from a dropped connection or an unrelated FK failure — that
 * conflation is what let VLT-02's first-write path report a false 409 for
 * what was actually a 5xx. Total over `unknown` so it drops straight into a
 * `catch (err)` block.
 *
 * Does NOT cover a 23505 raised inside `$queryRaw`/`$executeRaw` — Prisma
 * wraps raw-query failures as P2010, not P2002, so this returns `false` for
 * those even though Postgres reports the same underlying constraint code.
 */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * True iff `err` is a foreign-key violation raised through Prisma's ORM layer
 * (P2003 — a `create`/`update`/`upsert` write). Same raw-query caveat as
 * {@link isUniqueViolation}: a 23503 from `$queryRaw`/`$executeRaw` surfaces
 * as P2010, not P2003, and is not recognised here.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}
