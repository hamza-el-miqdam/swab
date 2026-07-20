# SUG-DB-010 — seed.ts wipes every table with no environment guard

- **Area:** db
- **Topic:** integrity
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** n/a (Data Steward persona: "every other agent's code is disposable, the data is not")

## Problem / Opportunity

`packages/db/prisma/seed.ts:42–49` unconditionally `deleteMany()`s all eight tables before seeding. The only safety is a comment (`seed.ts:9`: "dev/preview branches only — wipes data" and `:41` "disposable branches only"). Nothing stops:

- `pnpm --filter @repo/db db:seed` run in a shell whose `DATABASE_URL` points at a shared or production database;
- `prisma migrate reset`/`migrate dev` auto-invoking the seed (`packages/db/package.json:21–23` registers it under the `prisma.seed` hook) against whatever `DATABASE_URL` is loaded.

One mistyped env var equals total data loss including every user's `Vault` blob — which is unrecoverable by design (key never leaves the device; VLT-05 accepts device-loss = data-loss, not server-side loss).

## Implementation plan

1. Add a guard at the top of `main()` in `packages/db/prisma/seed.ts` (before any `deleteMany`):
   ```ts
   const url = process.env.DATABASE_URL ?? "";
   const allowWipe =
     process.env.SEED_ALLOW_WIPE === "1" ||
     /localhost|127\.0\.0\.1|(^|@)db:/.test(new URL(url).host); // local + docker-compose service host
   if (process.env.NODE_ENV === "production" || !allowWipe) {
     process.stderr.write("seed refused: destructive seed only runs against local/compose DBs or with SEED_ALLOW_WIPE=1\n");
     process.exit(2);
   }
   ```
   (`db` is the compose service host used by the API container, `docker-compose.yml:46` runs against the compose network.)
2. Document `SEED_ALLOW_WIPE` in `packages/db/.env.example` as a commented line (placeholder only, per G1) and in the seed header comment (`seed.ts:1–10`).
3. Preview/CI branches (Neon) opt in explicitly by exporting `SEED_ALLOW_WIPE=1` in the workflow — coordinate wording with `area:sre` when that workflow exists; no workflow edit needed now.
4. Changelog entry.

## Tests & acceptance criteria

- Unit tests for the guard (extract it as an exported pure function `canWipe(url, env): boolean` so it's testable without a DB — also counts toward the 80% seed-helper coverage, data-specialist.md rule 6):
  - production NODE_ENV → false regardless of host;
  - `postgresql://…@localhost:5432/swab` → true; compose host `db` → true;
  - a `*.aws.neon.tech`-shaped host without `SEED_ALLOW_WIPE` → false; with `=1` → true.
- Integration (SUG-DB-004 harness): seed against the Testcontainers URL with `SEED_ALLOW_WIPE=1` succeeds; without it, exits 2 and leaves rows untouched.

## Risks & gotchas

- Testcontainers URLs use `localhost` with a random port — the host allowlist already passes them; keep the check on host, not port.
- Do not weaken to a y/N prompt: seeds run non-interactively in CI/compose; an env-var opt-in is the honest machine-checkable contract.
- Keep exit code non-zero on refusal so CI fails loudly instead of "seeded nothing, tests pass vacuously".
