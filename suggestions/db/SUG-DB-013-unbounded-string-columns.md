# SUG-DB-013 — Unbounded `text` columns where the API contract has hard caps (phoneHash, displayName, verb, category, place, pushToken)

- **Area:** db
- **Topic:** integrity
- **Impact:** low
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** IDT-01

## Problem / Opportunity

Prisma `String` maps to unbounded `text`. Every string column in the schema is unbounded, while the API boundary already enforces tight caps — the DB should encode the same contract (defense in depth; steward persona: "knowing exactly what every byte stored says about a user"):

- `User.phoneHash` (`packages/db/prisma/schema.prisma:16`): API accepts 32–128 chars of `[A-Za-z0-9_-]` (`apps/api/src/routes/auth.ts:14–18`), and the seed generates 64-hex sha256 (`packages/db/prisma/seed.ts:23–25`) — yet the column stores unlimited text.
- `User.displayName` (schema.prisma:17): API caps at 50 (`auth.ts:25` `.max(50)`), column unbounded — any non-route writer can insert megabytes.
- `Envie.verb` / `Envie.category` (schema.prisma:76–77): user content and the matching key; no cap exists anywhere yet (envie routes unimplemented) — setting one now defines the contract Backend will code against. `category` is also an index key (`@@index([category, ...])`, schema.prisma:86) where huge values bloat the btree.
- `Proposal.place` (schema.prisma:130), `Device.pushToken` (schema.prisma:48): free-form but bounded in reality (APNs/FCM tokens ≤ ~4 KB).

## Implementation plan

1. In `schema.prisma`, add native types (values chosen to match/lead the API contract — record them in the changelog as the canonical caps):
   - `phoneHash String @unique @map("phone_hash") @db.VarChar(128)`
   - `displayName String @map("display_name") @db.VarChar(50)`
   - `verb String? @db.VarChar(280)` (nullable per SUG-DB-005; 280 is a proposal — confirm with spec-specialist if ENV-01 implies a copy limit, and stop if ambiguous per G4)
   - `category String @db.VarChar(64)`
   - `place String? @db.VarChar(200)`
   - `pushToken String? @map("push_token") @db.VarChar(4096)`
2. Migration `string_caps` (pure `ALTER COLUMN ... TYPE varchar(n)` — metadata-only in Postgres when widening from text with a check; here it's a narrowing so Postgres validates existing rows: run the count-oversize sanity queries in the Data-impact section first; seed data is far under every cap).
3. Regenerate client (no TS type change); PR note to `area:api`: future envie/proposal Zod schemas must mirror these caps (single source: this changelog entry).
4. Changelog entry.

## Tests & acceptance criteria

- Constraint tests (SUG-DB-004 harness): 129-char phoneHash insert rejects; 51-char displayName rejects; 50-char succeeds (boundary).
- Seed green (all seeded values within caps: 64-hex hashes, short names/verbs).
- Turbo gate green.

## Risks & gotchas

- **Narrowing is contract-phase** (data-specialist.md:21): today it's safe because the API already rejects longer values and only seed data exists; after launch this class of change would need expand→contract. Land it early.
- `varchar(n)` counts characters, not bytes — multi-byte French content in `verb`/`place` is fine at these limits, but don't translate the API's byte-oriented reasoning 1:1.
- Do NOT add a CHECK on phoneHash format (e.g. hex-only): the client-side hash encoding may evolve (base64url is already allowed at the API, `auth.ts:18`) — length cap only.
