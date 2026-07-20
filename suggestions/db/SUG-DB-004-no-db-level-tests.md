# SUG-DB-004 — packages/db has zero tests: no deletion-cascade, constraint, or seed tests

- **Area:** db
- **Topic:** testing
- **Impact:** high
- **Effort:** L
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** IDT-04, ENV-09 (G2; data-specialist.md rules 2, 5, 6)

## Problem / Opportunity

`packages/db/package.json:11–20` has no `test` script at all — `pnpm turbo run test` silently skips the package, so the 80% coverage gate (G2) never applies to it. Meanwhile:

- `agents/data-specialist.md:36` mandates "maintain a deletion integration test proving zero orphaned rows for a deleted user" (IDT-04 / GDPR path — currently it would FAIL, see SUG-DB-001).
- `agents/data-specialist.md:39` mandates "an integration test that hammers concurrent envie creation and proves single-match" (ENV-09 — currently it would FAIL, see SUG-DB-003).
- `agents/data-specialist.md:40` lists the TDD stack: migration tests, constraint tests via Testcontainers Postgres, deletion-cascade, concurrency; 80% coverage on `seed.ts` helpers (`syntheticPhoneHash`, `hoursFromT0` at `packages/db/prisma/seed.ts:23–31` are exported but untested).
- `apps/api` tests run only against an in-memory double (`apps/api/tests/fake-repo.ts`; the exception is documented at `apps/api/src/repo.ts:5–8` as "temporary … Testcontainers Postgres integration tests replace the in-memory double next sprint"), so `apps/api/src/prisma-repo.ts` — the only real DB consumer — has never executed against Postgres in CI.

## Implementation plan

1. Add devDependencies to `packages/db/package.json` with G4 justification in the PR: `vitest`, `@vitest/coverage-v8`, `testcontainers` (dev-only, standard Postgres container, no vendor lock — runs on stock `postgres:17`, matching data-specialist.md:24).
2. Add `"test": "vitest run --coverage"` to scripts and a `vitest.config.ts` with the 80% line threshold scoped to `prisma/seed.ts` and `src/` (mirror the pattern in `apps/api/vitest.config.ts`).
3. Create `packages/db/tests/setup.ts`: start `postgres:17` via Testcontainers once per suite, export `DATABASE_URL`, apply migrations with `prisma migrate deploy` (depends on SUG-DB-002's baseline; fall back to `prisma db push` only until that lands).
4. Write the tests (failing-first where they expose known gaps):
   - `tests/deletion-cascade.test.ts` (`test_IDT04_deletion_zero_orphans`): create a full object graph for a user (vault, device, links out AND in, envie authored, envie *received*, match, proposal), delete the user, assert every table has zero rows referencing the deleted id. Red until SUG-DB-001 merges.
   - `tests/match-race.test.ts` (`test_ENV09_reciprocal_race_single_match`): concurrent canonicalized inserts → exactly one match row. Red until SUG-DB-003 merges.
   - `tests/constraints.test.ts`: unique `phoneHash` (schema.prisma:16), unique `(ownerId,targetId)` (schema.prisma:66), composite PK on `envie_recipients` (schema.prisma:97), FK violations reject.
   - `tests/seed.test.ts`: run `main()` twice against the container (idempotence), assert the summary counts (`packages/db/prisma/seed.ts:163–172`) and unit-test `syntheticPhoneHash`/`hoursFromT0` determinism.
5. Update the file-scope note: tests live under `packages/db/tests/` — inside the steward's `packages/db/**` scope.
6. Changelog entry; flip any relevant `docs/STATUS.md` infra row.

## Tests & acceptance criteria

- `pnpm --filter @repo/db test` green locally with Docker available; coverage ≥ 80% on changed files.
- `pnpm turbo run lint typecheck test build` green (turbo already orders `^db:generate` before `test`, `turbo.json:13`).
- The two red tests (cascade, race) are committed red-first only if their fixes land in the same stack; otherwise land tests together with SUG-DB-001/003 fixes per TDD.

## Risks & gotchas

- CI runner needs Docker for Testcontainers — coordinate with `area:sre` (`.github/workflows/ci.yml` currently has no service containers); ubuntu-latest has Docker, but timeouts should be generous for image pull.
- Never mock Prisma in these tests (G2: "no mocking of Prisma in integration tests").
- Keep the container DB throwaway per run — never point tests at `DATABASE_URL` from the environment, or a developer could wipe a real dev branch.
