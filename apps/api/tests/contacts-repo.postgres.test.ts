/**
 * The `ContactsRepository` contract, run against a REAL Postgres — no Prisma
 * mocking (G2). This is the authoritative half: it is the only place the
 * partial unique indexes, the `ring` CHECK, the `ON DELETE CASCADE` on
 * `target_id` and the transactional idempotency ledger (VLT-07) are actually
 * exercised. The in-memory double mirrors the same suite so route tests stay
 * honest, but it proves nothing about the database.
 *
 * DATABASE_URL resolution matches `prisma-repo.test.ts` (issue #22, no
 * Testcontainers): CI's `postgres:17` service supplies it; locally it defaults
 * to the docker-compose `db` service. `@repo/db` reads the variable at
 * construction time, so the default must land before the import — hence the
 * dynamic `import()`.
 */
import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";

const DEFAULT_LOCAL_DATABASE_URL = "postgresql://swab:swab_local_dev@localhost:5432/swab";
process.env.DATABASE_URL ??= DEFAULT_LOCAL_DATABASE_URL;

const { prisma } = await import("@repo/db");
const { prismaRepository } = await import("../src/prisma-repo.js");
const { runContactsRepositoryContract } = await import("./contacts-contract.js");

/** Never echo credentials in an error message (G1) — user:pass is stripped. */
function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/[^@/]+@/, "//***:***@");
}

try {
  await prisma.$queryRaw`SELECT 1`;
} catch (err) {
  const target = redactDatabaseUrl(process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL);
  throw new Error(
    `Postgres unreachable at ${target} — run \`docker compose up -d db\` and ` +
      `\`pnpm --filter @repo/db db:deploy\` first, then re-run the tests.`,
    { cause: err },
  );
}

const repo = prismaRepository();
// Only the ids this file created are deleted; contact links, roles and ledger
// rows cascade with their User. A developer's local data is never touched.
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
});

runContactsRepositoryContract("Prisma + Postgres", async () => ({
  repo,
  async createUser() {
    // `tc-` prefix + uuid: unique, obviously synthetic, and within the
    // varchar(50) displayName / varchar(128) phoneHash contracts.
    const id = randomUUID();
    const user = await repo.createUser(`test-contacts-${id}`, `tc-${id}`.slice(0, 50));
    createdUserIds.push(user.id);
    return user.id;
  },
}));
