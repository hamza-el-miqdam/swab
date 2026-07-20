# SUG-DB-012 — Vault: no DB-level 1 MB quota check and no createdAt

- **Area:** db
- **Topic:** integrity
- **Impact:** low
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** VLT-03

## Problem / Opportunity

1. **Quota is app-layer only.** VLT-03 (`docs/specs/FS-07-identity-vault.md:34`) caps the blob at ≤1 MB per user (free-tier budget). The only enforcement is in the route (`apps/api/src/routes/vault.ts:13` `MAX_VAULT_BYTES = 1_048_576`, checked at `:57`). Any other write path — a future admin script, a second service, a bug that bypasses the route — can blow the storage budget on `vaults.blob` (`packages/db/prisma/schema.prisma:37`). Byte-length inspection is the one explicitly permitted operation on the blob (VLT-03: "beyond byte length for quota"), so a DB CHECK is invariant-compliant defense in depth.
2. **Missing createdAt.** `Vault` has only `updatedAt` (schema.prisma:39), violating the steward's own standard "timestamps `createdAt`/`updatedAt` everywhere" (`agents/data-specialist.md:30`). First-sync time is useful for support ("has this user ever synced?") without touching content.

## Implementation plan

1. Schema (`packages/db/prisma/schema.prisma`, model `Vault`): add
   ```prisma
   createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
   ```
   (drop the `@db.Timestamptz(3)` suffix if SUG-DB-008 hasn't landed — keep column conventions consistent with the rest of the schema at that moment).
2. Customized migration `vault_quota_and_created_at` (`--create-only`, then append):
   ```sql
   ALTER TABLE "vaults"
     ADD CONSTRAINT "vaults_blob_quota" CHECK (octet_length("blob") <= 1048576);
   ```
   For existing rows, `createdAt` backfills to `now()` via the default — acceptable (no true creation record exists).
3. Add a `///` comment on the model noting the CHECK lives in that migration and mirrors `MAX_VAULT_BYTES` in `apps/api/src/routes/vault.ts:13` — if the quota ever changes, both places change together (note for Backend in the PR).
4. Seed: optionally set `createdAt: T0` on the two vault creates (`packages/db/prisma/seed.ts:59–64`) for determinism.
5. Changelog entry with the privacy-audit note: CHECK uses `octet_length` only — no content inspection, VLT-03-compliant.

## Tests & acceptance criteria

- Constraint test (SUG-DB-004 harness): inserting a 1 048 577-byte buffer into `vaults.blob` rejects with the CHECK violation; 1 048 576 bytes succeeds.
- Route behavior unchanged: the existing API test suite (`apps/api/tests/vault.test.ts`) stays green — the route rejects at 413 before the DB ever sees an oversized blob.
- `prisma validate` + turbo gate green.

## Risks & gotchas

- The CHECK is a backstop, not the primary gate — the route's 413 must keep firing first so clients get a friendly error instead of a 500-wrapped constraint violation.
- Same Prisma-can't-model-CHECK caveat as SUG-DB-003/009: verify the CI drift check tolerates it.
- If any existing environment somehow holds an oversized blob, the `ADD CONSTRAINT` fails — precede with a `SELECT count(*) FROM vaults WHERE octet_length(blob) > 1048576` sanity check in the PR's Data-impact section (expected 0 everywhere today).
