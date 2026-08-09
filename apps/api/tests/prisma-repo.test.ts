/**
 * Integration tests for prisma-repo.ts against a REAL Postgres — no Prisma
 * mocking (G2). This is the suite that closes the documented gap left by the
 * walking-skeleton `fake-repo.ts` double (see its header comment + backend
 * rule 7). IDT-01 (user identity) / VLT-02 (versioned vault + optimistic
 * concurrency) are exercised directly against `@repo/db`'s Prisma client.
 *
 * DATABASE_URL resolution (product-owner decision, issue #22): no
 * Testcontainers (G4 — no new dependency to carry this). This suite reuses
 * whichever real Postgres is already wired for the project:
 *   - CI: the `postgres:17` `services:` container in `.github/workflows/ci.yml`
 *     supplies DATABASE_URL as a step env var — respected as-is below.
 *   - Local dev: if DATABASE_URL is unset, we default to the docker-compose
 *     `db` service's URL (matches apps/api/.env.example) so `pnpm --filter
 *     @repo/api test` works with zero manual export, as long as
 *     `docker compose up -d db` has been run.
 *
 * @repo/db's PrismaClient reads DATABASE_URL from the environment at
 * construction time, so the default above must land BEFORE `@repo/db` is
 * imported. Static imports are hoisted ahead of any top-level code in this
 * file, so the default + reachability check use dynamic `import()` — the
 * only way to guarantee ordering here.
 *
 * Test data hygiene: this suite runs against the SAME `swab` database as
 * local dev data (docker-compose provisions exactly one DB — no schema/compose
 * changes are in scope here). Every row created below uses a
 * `test-prisma-repo-` prefixed, `crypto.randomUUID()`-suffixed phoneHash and
 * displayName, and `afterEach` deletes only the User ids this file itself
 * created (Vault cascades via the schema's `onDelete: Cascade`) — reruns are
 * idempotent and a developer's local data is never touched.
 */
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const DEFAULT_LOCAL_DATABASE_URL = "postgresql://swab:swab_local_dev@localhost:5432/swab";
process.env.DATABASE_URL ??= DEFAULT_LOCAL_DATABASE_URL;

const { prisma } = await import("@repo/db");
const { prismaRepository } = await import("../src/prisma-repo.js");

/** Never echo credentials in an error message (G1) — user:pass is stripped. */
function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/[^@/]+@/, "//***:***@");
}

async function assertPostgresReachable(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const target = redactDatabaseUrl(process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL);
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Postgres unreachable at ${target} — run \`docker compose up -d db\` and ` +
        `\`pnpm --filter @repo/db db:deploy\` first, then re-run the tests. ` +
        `(underlying error: ${cause})`,
    );
  }
}

// One check, once, before any test runs — a single actionable failure instead
// of a wall of per-test connection-refused timeouts.
await assertPostgresReachable();

const repo = prismaRepository();

function syntheticIdentity(label: string): { phoneHash: string; displayName: string } {
  const id = randomUUID();
  return {
    phoneHash: `test-prisma-repo-${label}-${id}`,
    displayName: `test-prisma-repo-${label}-${id}`,
  };
}

describe("prismaRepository (integration, real Postgres)", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length === 0) return;
    // Vault rows cascade-delete with their User (schema onDelete: Cascade) —
    // deleting only the ids this file created keeps local dev data untouched.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  });

  async function createTestUser(label: string) {
    const { phoneHash, displayName } = syntheticIdentity(label);
    const user = await repo.createUser(phoneHash, displayName);
    createdUserIds.push(user.id);
    return user;
  }

  describe("findUserByPhoneHash / createUser (IDT-01)", () => {
    it("returns null for a phoneHash that does not exist", async () => {
      const { phoneHash } = syntheticIdentity("missing");
      await expect(repo.findUserByPhoneHash(phoneHash)).resolves.toBeNull();
    });

    it("createUser persists the row and findUserByPhoneHash reads it back", async () => {
      const { phoneHash, displayName } = syntheticIdentity("roundtrip");
      const created = await repo.createUser(phoneHash, displayName);
      createdUserIds.push(created.id);

      expect(created.id).toBeTruthy();
      expect(created.phoneHash).toBe(phoneHash);
      expect(created.displayName).toBe(displayName);

      const found = await repo.findUserByPhoneHash(phoneHash);
      expect(found).toEqual(created);
    });
  });

  describe("getVault (VLT-02)", () => {
    it("returns null when the user has no vault yet", async () => {
      const user = await createTestUser("no-vault");
      await expect(repo.getVault(user.id)).resolves.toBeNull();
    });

    it("returns the stored blob, version, and updatedAt after a write", async () => {
      const user = await createTestUser("get-vault");
      const blob = Buffer.from([0x00, 0xff, 0x89, 0x50, 0x4e, 0x47]);

      const written = await repo.upsertVault(user.id, blob, 0);
      expect(written).toEqual({ ok: true, version: 1 });

      const vault = await repo.getVault(user.id);
      expect(vault).not.toBeNull();
      expect(vault?.userId).toBe(user.id);
      expect(vault?.blob.equals(blob)).toBe(true);
      expect(vault?.version).toBe(1);
      expect(vault?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("upsertVault optimistic concurrency (VLT-02)", () => {
    it("creates the vault at version 1 when baseVersion is 0 and none exists", async () => {
      const user = await createTestUser("create");
      const result = await repo.upsertVault(user.id, Buffer.from("v1"), 0);
      expect(result).toEqual({ ok: true, version: 1 });
    });

    it("a correct baseVersion update succeeds and bumps the version (compare-and-swap)", async () => {
      const user = await createTestUser("cas-success");
      await repo.upsertVault(user.id, Buffer.from("v1"), 0);

      const second = await repo.upsertVault(user.id, Buffer.from("v2"), 1);
      expect(second).toEqual({ ok: true, version: 2 });

      const vault = await repo.getVault(user.id);
      expect(vault?.blob.equals(Buffer.from("v2"))).toBe(true);
    });

    it("a stale baseVersion is rejected with the current version (conflict path)", async () => {
      const user = await createTestUser("cas-conflict");
      await repo.upsertVault(user.id, Buffer.from("v1"), 0); // version 1
      await repo.upsertVault(user.id, Buffer.from("v2"), 1); // version 2

      // Retrying from the now-stale baseVersion 1.
      const stale = await repo.upsertVault(user.id, Buffer.from("v3-stale"), 1);
      expect(stale).toEqual({ ok: false, currentVersion: 2 });

      // The stale write must not have landed.
      const vault = await repo.getVault(user.id);
      expect(vault?.version).toBe(2);
      expect(vault?.blob.equals(Buffer.from("v2"))).toBe(true);
    });

    it("baseVersion 0 against an already-created vault reports the conflict (sequential race-to-create)", async () => {
      const user = await createTestUser("race-sequential");
      const first = await repo.upsertVault(user.id, Buffer.from("winner"), 0);
      expect(first).toEqual({ ok: true, version: 1 });

      // A second writer that also believed it was first (stale local state).
      const second = await repo.upsertVault(user.id, Buffer.from("loser"), 0);
      expect(second).toEqual({ ok: false, currentVersion: 1 });

      const vault = await repo.getVault(user.id);
      expect(vault?.blob.equals(Buffer.from("winner"))).toBe(true);
    });

    it("two concurrent baseVersion 0 upserts settle to exactly one winner (true race-to-create)", async () => {
      const user = await createTestUser("race-concurrent");

      const [a, b] = await Promise.all([
        repo.upsertVault(user.id, Buffer.from("racer-a"), 0),
        repo.upsertVault(user.id, Buffer.from("racer-b"), 0),
      ]);

      const results = [a, b];
      const winners = results.filter((r) => r.ok);
      const losers = results.filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(winners[0]).toEqual({ ok: true, version: 1 });
      expect(losers[0]).toEqual({ ok: false, currentVersion: 1 });

      // Exactly one blob landed — whichever writer actually won.
      const vault = await repo.getVault(user.id);
      expect(vault?.version).toBe(1);
      const landedWinningBlob =
        vault?.blob.equals(Buffer.from("racer-a")) === true ||
        vault?.blob.equals(Buffer.from("racer-b")) === true;
      expect(landedWinningBlob).toBe(true);
    });
  });
});
