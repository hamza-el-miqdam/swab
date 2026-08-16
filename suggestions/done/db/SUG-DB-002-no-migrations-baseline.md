# SUG-DB-002 — No migrations exist: schema is `db push`-only, with no CI apply check

- **Area:** db
- **Topic:** migrations
- **Impact:** high
- **Effort:** M
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** n/a (Data Steward "Migration Discipline" section; swab-domain-spec.md §6 item 1: "schema above, migration `init`")

## Problem / Opportunity

There is no `packages/db/prisma/migrations/` directory at all (verified by full file listing of `packages/db` — only `schema.prisma` and `seed.ts` exist under `prisma/`). Evidence:

- `packages/db/CHANGELOG.md:12` — "No migrations yet — local dev uses `prisma db push` from the API container; real migrations land with the first production deploy."
- `docker-compose.yml:46` — API container runs `prisma db push --skip-generate` on every boot.
- `.github/workflows/ci.yml:15–28` — CI has no Postgres service, no `prisma migrate deploy` step, no drift check; `packages/db/package.json:13–14` defines `db:migrate`/`db:deploy` scripts that currently have nothing to apply.

`agents/data-specialist.md:19–24` requires forward-only migrations, "Every migration must apply cleanly to a fresh … branch created from `main` in CI — this is the required check", and forbids `db push` against shared branches. Deferring the baseline until "first production deploy" means the first migration will be generated against a schema that other suggestions (SUG-DB-001/003/005/008) are meanwhile mutating — every schema change made now is unversioned and unreviewable as SQL.

## Implementation plan

1. Create the baseline: `cd packages/db && pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/init.sql` (inspect output), then create `prisma/migrations/20260719000000_init/migration.sql` with that SQL and `prisma/migrations/migration_lock.toml` containing:
   ```toml
   provider = "postgresql"
   ```
2. Verify it applies to a fresh database: `docker compose up -d db` (Postgres :5432), point `DATABASE_URL` at a scratch database, run `pnpm --filter @repo/db db:deploy`, then `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code` — must exit 0 (no drift).
3. For any environment already `db push`-ed (dev branches), document the resolve step in the changelog entry: `prisma migrate resolve --applied 20260719000000_init`.
4. Out-of-scope coordination (data steward may not edit these files — open issues instead):
   - `area:sre` issue: add a CI job with a `postgres:17` service that runs `migrate deploy` + the drift check from step 2 (the "fresh branch apply" required check), and change `docker-compose.yml:46` from `db push` to `prisma migrate deploy`.
5. Append `packages/db/CHANGELOG.md` entry; update `docs/STATUS.md` infrastructure row if one tracks migrations.

## Tests & acceptance criteria

- `pnpm --filter @repo/db db:deploy` against an empty `postgres:17` database succeeds and creates all 8 tables + 4 enums with snake_case names.
- `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code` returns 0.
- `pnpm --filter @repo/db db:seed` succeeds on the migrated (not pushed) database.
- Once SUG-DB-004's test harness exists: a migration test that applies all migrations to a Testcontainers Postgres from scratch.

## Risks & gotchas

- **Order matters:** land this baseline BEFORE the other schema-changing suggestions (001, 003, 005, 006, 007, 008, 012, 013, 015) so each lands as its own reviewable migration — "Never batch unrelated model changes into one migration" (data-specialist.md:16).
- Prisma's generated baseline SQL must be eyeballed for the `@@map` names — client code depends on snake_case tables matching what `db push` created, or existing dev DBs will need `migrate resolve` (step 3).
- Do not run `migrate dev` against any shared branch; use a scratch/local database for generation (data-specialist.md:22).
