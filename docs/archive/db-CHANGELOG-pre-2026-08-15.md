# packages/db changelog archive — before 2026-08-15

> 2 entries dated before 2026-08-15, moved out of the active changelog on 2026-08-16 so it stays small enough to read in full.
> **Nothing was deleted** — these are verbatim, and git history holds them regardless.
> The cutoff is the docs-hygiene-lint `GRANDFATHER_DATE`, so the active file now contains only guard-enforced entries.
> Active changelog: [../../packages/db/CHANGELOG.md](../../packages/db/CHANGELOG.md)

## 2026-08-08 — [SUG-DB-002] Baseline migration (no more `db push`-only schema)

- Added `prisma/migrations/20260719000000_init/migration.sql` (generated via `prisma migrate diff --from-empty --to-schema-datamodel`) + `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`) — the first real, reviewable migration, covering the full v0.1 schema (8 tables, 4 enums, all snake_case `@@map` names, matching what `db push` was already creating).
- Verified against a scratch `postgres:17` container: `db:deploy` applies cleanly (9 relations incl. `_prisma_migrations`), `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code` reports "No difference detected" (exit 0), and `db:seed` succeeds on the migrated (not pushed) database.
- **Gotcha for anyone with an existing local `db push`-created DB**: applying `migrate deploy` will fail because the tables already exist. Run `pnpm --filter @repo/db exec prisma migrate resolve --applied 20260719000000_init` once against that database to mark the baseline as already-applied, then `migrate deploy` going forward.
- Out of scope (filed as a devops issue): CI has no Postgres service / migrate-deploy drift check yet, and `docker-compose.yml` still runs `prisma db push` on API boot — both need an `area:sre` change.
- Order matters: land any further schema changes (SUG-DB-001/003/005/006/007/008/012/013/015) as their own migrations from here on — never batch unrelated model changes into one migration.

## 2026-07-05 — Schema v0.1 (commit e2914a0)

- Initial models: `users` (id, phoneHash, displayName), `vaults` (opaque `blob` + `version` per user), `envies` (skeleton for FS-05).
- Privacy audit note: no table or column stores rings, tags, rules, subgroup names, or scope names — classification exists only inside `vaults.blob` ciphertext. Verifiable via Adminer (:8080) on the local stack.
- `seed.ts` for local development.
- No migrations yet — local dev uses `prisma db push` from the API container; real migrations land with the first production deploy.

