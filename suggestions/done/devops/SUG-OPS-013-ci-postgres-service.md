# SUG-OPS-013 — CI has no Postgres, so the G2-mandated integration tests have nowhere to run

- **Area:** devops
- **Topic:** ci
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G2: "integration tests against a real Postgres … no mocking of Prisma in integration tests")

## Problem / Opportunity

G2 (`agents/_global-directives.md`) requires "integration tests against a real Postgres (Neon CI branch), no mocking of Prisma in integration tests". Today:

- CI (`.github/workflows/ci.yml:15-28`) provisions no database — no `services:` block, no `DATABASE_URL`.
- Consequently the API's DB layer is simply excluded from testing: `apps/api/vitest.config.ts:13` excludes `src/prisma-repo.ts` from coverage with the comment "needs Postgres … covered by the upcoming Testcontainers integration suite — documented gap" (`vitest.config.ts:10-12`). All current tests run against `tests/fake-repo.ts`.

Writing the integration tests is backend-specialist work, but the *infrastructure* precondition — a real Postgres in CI — is devops, and unblocks that documented gap. A GitHub Actions `services:` container is simpler, faster, and cheaper than Neon CI branches at this stage (no secrets, no branch GC), and matches the local stack (`docker-compose.yml:13-14`, vanilla `postgres:17`, which is itself the portability guardrail).

## Implementation plan

1. Edit `.github/workflows/ci.yml`, add to the `ci` job:
   ```yaml
   services:
     postgres:
       image: postgres:17
       env:
         POSTGRES_USER: swab
         POSTGRES_PASSWORD: swab_ci
         POSTGRES_DB: swab_test
       ports: ["5432:5432"]
       options: >-
         --health-cmd "pg_isready -U swab -d swab_test"
         --health-interval 5s --health-timeout 3s --health-retries 10
   ```
2. Export the URL for the test step (`ci.yml:28`):
   ```yaml
   - run: pnpm turbo run lint typecheck test build
     env:
       DATABASE_URL: postgresql://swab:swab_ci@localhost:5432/swab_test
   ```
3. Add `"env": ["DATABASE_URL"]` to the `test` task in `turbo.json:13` so turbo's cache key includes it (otherwise a cached test result could be replayed across differing DB configs once SUG-OPS-009 lands):
   ```json
   "test": { "dependsOn": ["^db:generate"], "env": ["DATABASE_URL"] }
   ```
4. Schema setup for the integration suite: before the turbo step, `pnpm --filter @repo/db exec prisma db push --skip-generate` (mirrors the compose bootstrap at `docker-compose.yml:46`, since no migration files exist yet per that comment). Guard it with the same env.
5. Coordinate with backend-specialist: file the follow-up issue "prisma-repo integration tests (vitest, real Postgres, drop coverage exclusion at `apps/api/vitest.config.ts:13`)" referencing this plumbing. The devops PR itself must stay green with zero integration tests present (it only adds capacity).
6. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- CI run green; service container shows healthy in the job log.
- `psql` smoke step (temporary, or keep as verification): `pg_isready -h localhost -p 5432` succeeds in-job.
- `prisma db push` step applies the schema cleanly against the service container.
- Existing unit tests unaffected (they inject fake env via `loadEnv(source)`, `apps/api/src/env.ts:16`).

## Risks & gotchas

- Do NOT reach for Neon CI branches yet: free-tier budget rule (devops project rule 1, 10-branch cap) and no secrets currently exist in the repo's Actions config; the service container needs neither. Revisit Neon branches when preview deployments (preview.yml) arrive.
- Port 5432 collision is impossible on hosted runners (nothing else listens), but if a self-hosted runner ever appears, map to a random port via `${{ job.services.postgres.ports['5432'] }}`.
- Keep the CI creds obviously fake (`swab_ci`) — G1 forbids real secrets in files, and gitleaks (SUG-OPS-003) should not flag them; a path allowlist entry may be needed.
