# SUG-API-006 — The "next sprint" real-Postgres integration suite never landed: prisma-repo.ts has zero test coverage

- **Area:** backend
- **Topic:** testing
- **Impact:** medium
- **Effort:** L
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** VLT-02, IDT-01

## Problem / Opportunity

The entire DB-touching layer is untested. The exception was documented as temporary in three places, all dated 2026-07-05 (two weeks ago):

- `apps/api/src/repo.ts:6-8` — "Testcontainers Postgres integration tests replace the in-memory double next sprint"
- `apps/api/tests/fake-repo.ts:2-7` — same promise
- `apps/api/vitest.config.ts:10-13` — `prisma-repo.ts` excluded from coverage thresholds

That excluded file contains the riskiest code in the service: the vault optimistic-concurrency CAS (`apps/api/src/prisma-repo.ts:36-64`), whose semantics the fake double claims to "mirror exactly" (`fake-repo.ts:5-6`) but doesn't (see SUG-API-004: `createUser` duplicate handling diverges). Backend rule 7 requires "integration tests with `fastify.inject()` against real Postgres via Testcontainers, no Prisma mocks", and rule 6 requires verifying vanilla-Postgres portability by running against the `postgres:17` image — currently nothing does. The FS-07 acceptance criterion "two rapid vault writes … no 409 loop" is only proven against the in-memory double.

## Implementation plan

1. Add dev deps to `/Users/mikedown/Workspace/Swab/apps/api/package.json` (justify in PR per G4): `@testcontainers/postgresql` (and `testcontainers` peer). Pin the image to `postgres:17` (backend rule 6).
2. Create `apps/api/tests/integration/setup.ts`: start one `PostgreSqlContainer("postgres:17")` per suite (vitest `globalSetup` or a `beforeAll` in the file), export its connection URL, run `pnpm --filter @repo/db exec prisma db push --skip-generate` against it via `execSync` with `DATABASE_URL` set (matches the compose dev loop; swap to `migrate deploy` once real migrations exist).
3. `packages/db/src/index.ts:7` builds the singleton from ambient `DATABASE_URL` — set `process.env.DATABASE_URL` to the container URL in `globalSetup` **before** any test file imports `@repo/db`. If ordering proves fragile, the cleaner fix is the `prismaRepository(client)` parameter refactor from SUG-API-003 plus constructing a dedicated `PrismaClient({ datasources: { db: { url } } })` in the tests.
4. Create `apps/api/tests/integration/vault.integration.test.ts` using the real `prismaRepository()` + `buildApp` (same `helpers.makeApp` pattern, overriding `repo` and `dbHealth`):
   - full OTP signup → vault write → read roundtrip (bit-identical bytes against real `Bytes` column);
   - stale-version 409 with real CAS;
   - `"VLT-02: concurrent same-base writes — exactly one succeeds"` — `Promise.all` two `POST /vault` with the same base version; assert one 200 + one 409 (the `updateMany` count arbiter, `prisma-repo.ts:54-58`);
   - `"VLT-02: concurrent first writes — unique violation maps to conflict, not 500"` (exercises the P2002 path, `prisma-repo.ts:44-51`);
   - `"IDT-01: concurrent createUser — one user row"` (real unique constraint on `phone_hash`, `packages/db/prisma/schema.prisma:16`).
5. Gate the suite: name files `*.integration.test.ts`; add a vitest workspace/project or an `INTEGRATION=1` env guard (`describe.skipIf(!process.env.INTEGRATION)`) so `pnpm --filter @repo/api test` stays Docker-free locally, and add a `test:integration` script (`vitest run --coverage tests/integration`). Wire it into CI where Docker is available (flag for devops if `ci.yml` needs a job — CI edits are outside backend scope, so open an `area:devops` issue).
6. Remove `src/prisma-repo.ts` from the coverage `exclude` in `vitest.config.ts:13` for the integration run.
7. Update the three "next sprint" comments (repo.ts, fake-repo.ts, vitest.config.ts) — the docs must stop promising what now exists (G5 truthfulness) — and add a changelog entry.

## Tests & acceptance criteria

- Files/names as in step 4. Run: `INTEGRATION=1 pnpm --filter @repo/api test:integration` (Docker required); plain `pnpm --filter @repo/api test` unchanged and green without Docker.
- Acceptance: `prisma-repo.ts` line coverage > 80% in the integration run; concurrency tests pass repeatedly (`--repeat=5` locally) proving the CAS arbiter; suite runs against `postgres:17` proving no Neon-isms.

## Risks & gotchas

- Testcontainers needs a Docker socket — CI runner must provide it; keep the suite opt-in so unit CI lanes don't break.
- Prisma singleton + `tsx watch` caching (`packages/db/src/index.ts:3-11`): never import `@repo/db` at module top-level in integration files before the URL is set.
- `prisma db push` from inside a test costs ~seconds; do it once per container, not per test.
- Do not weaken fake-repo tests — the fast suite stays; integration adds, never replaces (rule 7 forbids Prisma mocks only in integration).
