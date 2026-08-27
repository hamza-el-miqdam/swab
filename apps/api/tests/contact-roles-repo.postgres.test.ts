/**
 * The `ContactRolesRepository` contract, run against a REAL Postgres — no
 * Prisma mocking (G2). Same pattern as `contacts-repo.postgres.test.ts`: the
 * in-memory double (`contact-roles-repo.fake.test.ts`) mirrors this suite so
 * route tests stay honest, but only this file actually exercises the
 * composite PK (`@@id([contactLinkId, role])`) and the transactional
 * idempotency ledger.
 *
 * Also closes the gap PR 1's changelog explicitly deferred here: a TRUE
 * concurrent `addRole` race — two different mutationIds, same role, same
 * contact, fired with `Promise.all` — which only a real Postgres transaction
 * abort (not a stub) can prove settles to exactly one `applied` and one
 * `no_op`, never a leaked P2002. `prisma-contacts-repo-error-mapping.test.ts`
 * already pins the same branch against a STUBBED client; this is its
 * real-database counterpart, mirroring the "two concurrent baseVersion 0
 * upserts settle to exactly one winner" pattern in `prisma-repo.test.ts`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const DEFAULT_LOCAL_DATABASE_URL = "postgresql://swab:swab_local_dev@localhost:5432/swab";
process.env.DATABASE_URL ??= DEFAULT_LOCAL_DATABASE_URL;

const { prisma } = await import("@repo/db");
const { prismaRepository } = await import("../src/prisma-repo.js");
const { runContactRolesRepositoryContract } = await import("./contact-roles-contract.js");

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

async function createTestUser(label: string): Promise<string> {
  const id = randomUUID();
  const user = await repo.createUser(`test-roles-${id}`, `tr-${label}-${id}`.slice(0, 50));
  createdUserIds.push(user.id);
  return user.id;
}

runContactRolesRepositoryContract("Prisma + Postgres", async () => ({
  repo,
  createUser: () => createTestUser("contract"),
}));

describe("ContactRolesRepository — true concurrent addRole race (VLT-07, Postgres)", () => {
  it("two concurrent addRole calls for the same role settle to exactly one applied, one no_op", async () => {
    const owner = await createTestUser("race");
    const created = await repo.createContact(owner, `seed-${randomUUID()}`, {
      invitedPhoneHash: `hash-${randomUUID()}`,
      displayName: "Race Contact",
    });
    if (created.outcome !== "created") throw new Error(`seed failed: ${created.outcome}`);
    const contactId = created.contact.id;

    // Different mutationIds — this is a genuine concurrent intent, not a
    // VLT-07 replay of the same id. Both calls hit the composite PK on
    // `ContactRole` at once; Postgres lets exactly one `create` win and
    // aborts the loser's transaction (P2002), which `addRole` must resolve
    // to `no_op` rather than let escape as a raw error.
    const [a, b] = await Promise.all([
      repo.addRole(owner, `race-a-${randomUUID()}`, contactId, "colleague"),
      repo.addRole(owner, `race-b-${randomUUID()}`, contactId, "colleague"),
    ]);

    const results = [a, b];
    const applied = results.filter((r) => r.outcome === "applied");
    const noOp = results.filter((r) => r.outcome === "no_op");
    expect(applied).toHaveLength(1);
    expect(noOp).toHaveLength(1);

    // Exactly one live role row landed, regardless of which call won.
    const role = await prisma.contactRole.findUnique({
      where: { contactLinkId_role: { contactLinkId: contactId, role: "COLLEAGUE" } },
    });
    expect(role).not.toBeNull();
    expect(role?.deletedAt).toBeNull();
  });
});
