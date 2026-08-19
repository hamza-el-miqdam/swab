# Changelog — packages/db (area:db)

> Newest first. One entry per schema/seed/migration change. **Only the Data Steward writes here** (same rule as `schema.prisma`).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: model diff summary, motivating query patterns, privacy-audit note.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

> Entries before 2026-08-15 are archived in [../../docs/archive/db-CHANGELOG-pre-2026-08-15.md](../../docs/archive/db-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

## 2026-08-19 — [SUG-DB-011, VLT-02] Typed error helpers: `isUniqueViolation`/`isForeignKeyViolation`

- **Problem:** `packages/db/src/index.ts` re-exports `@prisma/client` wholesale but offered no blessed way to discriminate a P2002/P2003 from any other failure, so `apps/api/src/prisma-repo.ts` had to `instanceof Prisma.PrismaClientKnownRequestError` by hand in two places — the exact ad hoc pattern the "never import `@prisma/client` directly" packaging comment (line 29) exists to avoid.
- **Fix:** added `isUniqueViolation(err: unknown)` and `isForeignKeyViolation(err: unknown)` to `packages/db/src/index.ts`, both total over `unknown` so they drop straight into a `catch (err)` block. No schema/migration change — packaging-only, no `prisma generate` impact.
- **Not done here (out of data-steward scope, per the suggestion's own plan):** swapping `prisma-repo.ts`'s two inline `instanceof` checks for the new helpers is an `area:api` follow-up — that file's bare-`catch` masking of VLT-02 was already independently fixed by SUG-API-003, so the follow-up is a DX cleanup, not a bug fix.
- **Tests:** 8 new pure-unit cases (`tests/error-helpers.test.ts`) against constructed `Prisma.PrismaClientKnownRequestError` instances — true on P2002/P2003 respectively, false on the other code, a plain `Error`, and non-error values (`undefined`/`null`/string). No PGlite/Postgres needed.
- **Privacy audit:** no data-shape or logging change.

## 2026-08-19 — [SUG-DB-013, IDT-01] Unbounded `text` columns now carry the API's length caps

- **Problem:** every `String` column mapped to unbounded Postgres `text`, while the API boundary already enforces tight caps (`phoneHash` 32-128, `displayName` 50) — the DB didn't encode the same contract, so any non-route writer (a script, a future admin tool) could insert unbounded data.
- **Fix:** migration `string_caps` narrows six columns to `varchar(n)`: `User.phoneHash` (128), `User.displayName` (50, matching the existing cap on `ContactLink.displayName`), `Envie.verb` (200 — mirrors ENV-17, which states `verb` <= 200 chars), `Envie.category` (64 — also an index key, caps btree bloat), `Proposal.place` (200), `Device.pushToken` (4096 — APNs/FCM tokens are far under this).
- **Not destructive:** narrowing is contract-phase (data-specialist.md:21) but safe pre-launch — only synthetic seed data exists today, all well under every cap; Postgres validates existing rows against the new length on `ALTER COLUMN ... TYPE`, which is the migration's own safety check.
- **Surfaced an out-of-contract test fixture:** `apps/api/tests/prisma-repo.test.ts` built a ~63-char `displayName`, which only worked because the column was unbounded. Fixed in this PR (hence the `area:backend` label) — the integration tests write via the repository, bypassing the route's Zod validation, so nothing had ever rejected it.
- **PR note to area:api:** future envie/proposal Zod schemas must mirror these caps (200/64/200). The **spec is the source** for `verb` (ENV-17, `docs/specs/FS-05-envie-match.md`); this entry only records where the DB now enforces it. Changing the cap is a spec amendment first, migration second.
- **Tests:** 7 new PGlite cases — a declarative `information_schema.columns.character_maximum_length` check across all six columns, plus boundary/over-cap behavioral inserts for phoneHash, displayName, verb, category, pushToken, and place.
- **Privacy audit:** no new columns exposed or logged; caps are structural, not content changes.

## 2026-08-19 — [SUG-DB-015, ENV-12, ENV-14] updatedAt on Envie, Match, Proposal, Device

- **Problem:** only `Vault` and `ContactLink`/`ContactRole` had `updatedAt`. Four mutable-state models had no transition timestamp: `Envie.status` (ACTIVE→EXPIRED/WITHDRAWN, ENV-12), `Match.state` (OPEN→…→EXPIRED), `Proposal.state` (PENDING→ACCEPTED/DECLINED/LAPSED, ENV-14), `Device.pushToken` (rotated by push providers, no way to spot stale devices).
- **Fix:** added `updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(3)` to all four models. Migration `updated_at_stateful_models` backfills existing rows to `now()` (honest "unknown before this date", same pattern as SUG-DB-012's `Vault.createdAt`). `User`, `ContactLink`'s own `targetId`-independent rows, and `EnvieRecipient` deliberately left alone (rule 5's insert-only-shape discipline) per the suggestion's scope note.
- **PR note to area:api:** `@updatedAt` is Prisma-client-managed, not a DB trigger — any raw-SQL sweep (expiry cron, retention job) must set `updated_at = now()` explicitly. **Hazard:** `Match.updatedAt` ticks when a pass marker is written (`passedBy*At`, SUG-DB-006) — any counterpart-facing serializer must never select `updatedAt`, or it becomes a covert pass-signal and breaks the ENV-15 bit-identity guarantee those columns exist to protect.
- **Tests:** 7 new PGlite cases — timestamptz type on all four new columns, insert-time default (`updatedAt == createdAt`), an explicit status-flip write advancing `updatedAt` past `createdAt` (ENV-12), and default-on-insert for `Match`/`Proposal`/`Device`.
- **Privacy audit:** transition timestamps are server-visible row metadata, not classification data; no new logging or cross-user exposure.

## 2026-08-18 — [SUG-DB-012, VLT-03] Vault: DB-level 1 MB quota CHECK + createdAt

- **Problem:** the 1 MB VLT-03 quota was enforced app-layer only (`apps/api/src/routes/vault.ts` `MAX_VAULT_BYTES`); any other write path (admin script, second service, route bug) could exceed the free-tier storage budget with nothing at the DB layer to stop it. `Vault` also had no `createdAt`, unlike every other model.
- **Fix:** migration `vault_quota_and_created_at` adds `createdAt DateTime @default(now())` and a hand-written CHECK `vaults_blob_quota` on `octet_length(blob) <= 1048576` (Prisma can't express CHECK). The CHECK inspects only byte length — VLT-03-compliant, no content read. Backstop only: the route's 413 must keep firing first so clients get a friendly error, not a 500-wrapped constraint violation. Seed's two vault rows now pass `createdAt: T0` for determinism.
- **Tests:** 3 new PGlite cases — a 1,048,576-byte blob accepted (boundary), a 1,048,577-byte blob rejected (`vaults_blob_quota`), and a fresh insert defaults `createdAt`.
- **Data impact:** no existing environment holds an oversized blob (seed data only, well under the cap) — the `ADD CONSTRAINT` is safe to apply as-is.
- **Privacy audit:** no new data logged or exposed; the CHECK and `createdAt` are metadata, not vault content.

## 2026-08-18 — [SUG-DB-006, ENV-15] Match.state can no longer represent a shared PASSED — per-side pass columns instead

- **Problem:** `MatchState` had a shared `PASSED` value with a comment promising "PASSED is private to the passer — the counterpart's reads are bit-identical either way", but one column cannot record *who* passed without either leaking it to the counterpart or destroying the pre-pass state (was the counterpart mid-proposal?). Unimplementable as modeled.
- **Fix:** removed `PASSED` from the shared `MatchState` enum (now `OPEN PROPOSED SCHEDULED EXPIRED`); added `Match.passedByAAt`/`passedByBAt` (`DateTime?`, timestamptz). A side's view state is `passedBy<side>At != null ? PASSED : state`; the counterpart's responses are computed from `state` alone and must never select the `passed_by_*` columns — a query-shape rule, not a DB constraint. Migration `match_per_side_pass` recreates the `match_state` Postgres enum (no `DROP VALUE` support) — safe as a same-PR change, not expand/migrate/contract, because no writer code for `Match` exists yet (matching isn't implemented in `apps/api`), so no row can hold `state = 'PASSED'` today.
- **PR note to area:api:** `POST /matches/:id/pass` (swab-domain-spec.md:160) must write only the caller's own `passedBy*At`; any `GET` response shaped for the counterpart must not select `passed_by_a_at`/`passed_by_b_at`.
- **Tests:** 3 new PGlite cases — `state = 'PASSED'` now rejected by the enum, setting `passedByAAt` leaves `state` untouched, and a counterpart-shaped select (`state, notifiedAt, createdAt`) stays bit-identical before/after a pass (`test_ENV15_pass_invisible_to_counterpart`).
- **Privacy audit:** the new columns are per-user private timestamps (ENV-15), not classification data; they must never be selected into a counterpart-facing payload — same directional-privacy contract as IDT-08.

## 2026-08-18 — [SUG-DB-010] seed.ts refuses to wipe anything but a local/compose DB

- **Problem:** `prisma/seed.ts` unconditionally `deleteMany()`s all eight tables before seeding, with only a comment as a safety net. A mistyped `DATABASE_URL`, or `prisma migrate dev`/`reset` auto-invoking the registered `prisma.seed` hook against the wrong connection, means total unrecoverable data loss — including every user's `Vault` blob (device-key-only, no server-side recovery path).
- **Fix:** extracted a pure, DB-less `canWipe(url, env)` helper: refuses when `NODE_ENV=production`; otherwise allows only `localhost`/`127.0.0.1`/the docker-compose `db` service host, or an explicit `SEED_ALLOW_WIPE=1` opt-in for disposable preview/CI (Neon) branches. `main()` calls it before any `deleteMany()` and exits 2 (not 0) on refusal. Also guarded the file's top-level `main()` invocation to run only when executed directly (`tsx prisma/seed.ts`), not on import — needed so the new unit test can import `canWipe` without triggering a live wipe attempt.
- **Docs:** `SEED_ALLOW_WIPE` documented as a commented placeholder in `.env.example` and in the seed file's header comment.
- **Tests:** 7 new Vitest cases on `canWipe` covering the acceptance table (production always false, localhost/127.0.0.1/compose host true, remote managed host false without the flag and true with it (vendor-neutral `*.example.com` fixture — a real provider hostname trips the G4 portability lint), unparseable URL false).
- **Privacy audit:** no new data stored, logged, or exposed — purely a destructive-action guard.

## 2026-08-18 — [SUG-DB-005, ENV-07, ENV-12] Envie.verb is nullable, unblocking the 30-day retention null-out

- **Problem:** `Envie.verb` was `String` (required), so the retention sweep had no way to comply with data-steward rule 3 ("expired envies are status-flipped, auditable, but verb content is nulled after 30 days") — expired desires stayed in plaintext forever.
- **Fix:** `verb String?`, migration `envie_verb_nullable` (pure `DROP NOT NULL`, no data migration, expand-phase safe). Added a doc comment on `EnvieStatus` naming `EXPIRED` + `verb IS NULL` as the post-retention terminal state. `category` (the matching key, ENV-08) is untouched and stays required.
- **Tests:** 1 new PGlite case — insert an expired envie, null its verb, assert the update succeeds and `category` survives.
- **Not implemented here:** the sweep itself is separate `area:sre`/`area:api` work (`UPDATE envies SET verb = NULL WHERE status = 'EXPIRED' AND expires_at < now() - interval '30 days'`) — flagged for that agent in the PR.
- **Privacy audit:** no new columns exposed; `verb` is still never logged or full-text-indexed. Backend must treat `verb: string | null` and never render a null verb to clients — no consumer exists yet (`apps/api` has no envie routes), so no type breakage.

## 2026-08-18 — [SUG-DB-009, IDT-07, IDT-08] ContactLink: no self-links, no orphaned rows, one live pending invite per phone hash

- **Problem:** three integrity gaps on `ContactLink`. (1) Every pending invite has `target_id = NULL`, and Postgres unique indexes treat NULLs as distinct, so one owner could hold unlimited duplicate pending invites to the same phone hash. (2) Nothing stopped `owner_id = target_id`. (3) `target`'s FK was `ON DELETE SetNull`, which — once resolution starts clearing `invited_phone_hash` per the contract below — can produce a row with both `target_id` and `invited_phone_hash` null: unreachable by any future query, dead weight forever.
- **Fix:** migration `contact_link_integrity` adds two hand-written CHECKs (`contact_links_no_self_link`, `contact_links_resolved_or_pending`) and a partial unique index `contact_links_owner_id_invited_phone_hash_live_key` on `(owner_id, invited_phone_hash) WHERE deleted_at IS NULL` — same partial-index treatment as the existing live-edge unique, so a tombstoned invite can be re-sent. `target`'s relation changes `SetNull` → `Cascade`: an account deletion now removes inbound links outright instead of nulling them, which is also what makes `resolved_or_pending` satisfiable (the audit at suggestion-write time predates ADR-001's tombstone model, which is why the original `@@unique([ownerId, targetId])` this suggestion cited no longer exists — superseded by the partial live-edge index).
- **Backend note (PR description):** resolving a pending invite (IDT-07) MUST set `target_id` and clear `invited_phone_hash` to NULL in the same update — NULLs are distinct in the unique index, so a correctly-resolved link never blocks a fresh invite to the same person. Not yet backend-implemented (no `ContactLink` code exists in `apps/api` yet), so no runtime behavior changes today.
- **Tests:** 7 new PGlite cases — self-link rejected, both-null rejected, two pending invites to different hashes accepted, duplicate live pending invite rejected, re-invite after tombstone accepted, resolved-then-reinvited accepted, target-user deletion cascades the link away. Updated the shared `newLink()` test helper (and two call sites) to carry a synthetic `invited_phone_hash` so pre-existing column-constraint tests still satisfy the new orphan CHECK.
- **Privacy audit:** no new columns, no new data logged; the CHECKs and index only compare existing id/hash columns.

## 2026-08-17 — [SUG-DB-008, ENV-07, ENV-08] Every pre-existing DateTime column becomes timestamptz(3)

- **Problem:** Prisma maps `DateTime` to `timestamp` without time zone by default, and no pre-ADR-001 column opted into `@db.Timestamptz(3)`. `Envie.expiresAt` drives matching (ENV-08) and the expiry sweep — comparing a naive column against `now()` is only correct while every writer/session agrees on UTC, and AWS portability (RDS/Aurora default `TimeZone` varies) is a hard requirement. ADR-001's new sync columns already shipped as timestamptz; this closed the gap that entry flagged.
- **Fix:** added `@db.Timestamptz(3)` to the eleven remaining columns (`User.createdAt`, `Vault.updatedAt`, `Device.createdAt`, `ContactLink.createdAt`, `Envie.expiresAt`/`createdAt`, `EnvieRecipient.createdAt`, `Match.notifiedAt`/`createdAt`, `Proposal.timeslot`/`createdAt`). Migration `timestamptz_columns` is pure `ALTER COLUMN ... TYPE TIMESTAMPTZ(3)` — no data migration, safe on the seed-only dev DB (Postgres reinterprets the naive value using the session time zone, lossless since all existing data is UTC).
- **Tests:** 12 new PGlite cases — one per converted column asserting `information_schema.columns.data_type = 'timestamp with time zone'`, plus a round-trip case that writes an envie, switches session `TIME ZONE` to `America/New_York`, and asserts the read-back instant is unchanged.
- **Not a behavior change for app code:** Prisma always sends/reads UTC regardless of column type; the win is at the SQL/ops layer (cron sweeps, ad-hoc queries, RDS migration).

## 2026-08-17 — [SUG-DB-007, IDT-04, IDT-05] Index every unindexed FK column

- **Problem:** Postgres does not auto-index FK-referencing columns, and Prisma only creates what's declared. Six FK columns had no index: `Device.userId`, `Envie.authorId`, `Match.userAId`/`userBId`/`envieBId`, `Proposal.matchId`/`proposerId`, `ContactLink.targetId`. Every one of them backs a real query pattern (push fanout, match-list `WHERE user_a_id = ? OR user_b_id = ?`, proposals-for-match) and a deletion cascade — account deletion touches 7 tables and must never sequential-scan (DAT rule 2).
- **Fix:** migration `fk_indexes` — eight pure `CREATE INDEX` statements, no data migration, non-destructive: `devices(user_id)`, `envies(author_id, status)` (leftmost prefix also serves bare authorId), `matches(user_a_id)`, `matches(user_b_id)`, `matches(envie_b_id)`, `proposals(match_id)`, `proposals(proposer_id)`, `contact_links(target_id)`.
- **Not touched:** `EnvieRecipient.envieId` (leading column of its composite PK, already covered) and `EnvieRecipient.recipientId` (already indexed since SUG-DB-001).
- **Tests:** 6 new PGlite cases asserting each index exists via `pg_indexes`, following the existing VLT-08 pattern.
- **Privacy audit:** indexes only cover id columns already present in the schema; nothing new is exposed or logged.

## 2026-08-17 — [SUG-DB-003, ENV-09] Canonical pair order arbitrates the reciprocal-match race

- **Problem:** `@@unique([envieAId, envieBId])` only blocks re-inserting the exact same ordered pair. Two concurrent transactions detecting the same reciprocal envies could each insert their own directional row — `(E1,E2)` and `(E2,E1)` — and both satisfy the constraint, producing two match rows for one pair (ENV-09 requires exactly one, ever). The matching engine doesn't exist in `apps/api` yet, so this was untested by any consumer — the cheapest moment to fix it.
- **Fix:** migration `match_pair_canonical_order` adds a hand-written `CHECK (envie_a_id < envie_b_id)` (Prisma can't express it). `schema.prisma` documents the invariant on `Match`: `envieAId` is always the lexicographically smaller id, `userAId`/`userBId` the corresponding authors. `seed.ts`'s reciprocal-pair fixture now sorts before insert, since `cuid()` creation order does not guarantee lexicographic order.
- **Tests:** 3 new PGlite cases — canonical order accepted, reversed order rejected by the CHECK, and the same canonical pair inserted twice still rejected by the pre-existing unique index (the race's losing side).
- **Backend note (PR description):** match insertion must canonicalize `[envieId1, envieId2].sort()` and map `userA`/`userB` accordingly before insert — a reversed insert now fails loudly (CHECK violation) instead of silently duplicating.

## 2026-08-17 — [VLT-01..10, FCH-09, ONB-04] ADR-001 stage 2: classification moves into typed columns

- **Model diff:** `ContactLink` absorbs the four axes (`displayName`, `ring`, `etat`, `ressenti`) plus FCH-05 staleness state; new `ContactRole` (multi-select rôles, one row per tag); new `ClientMutation` (VLT-07 idempotency ledger); new enums `etat` / `ressenti` / `role_contexte`. Merged into the edge rather than a 1:1 side table because every axis read is an edge read — the map, the fiche and scope resolution all want them together.
- **Enum values are the FCH-09 identifiers verbatim** (`available`, not `AVAILABLE`, not « disponible ») via `@map`, so a stored byte is identical on device and in Postgres. FS-03 § *Stored value vocabulary* stays the SSOT: adding a value is a spec amendment first, migration second. The closed enum means the server rejects a legacy French token — clients tolerate them for old blobs, the server must not.
- **Query patterns:** `@@index([ownerId, updatedAt])` on links and `([contactLinkId, updatedAt])` on roles serve the VLT-08 cursor delta pull; the existing `invitedPhoneHash` index is untouched.
- **Two constraints Prisma cannot express, hand-written in the migration:** a **partial** unique on `(owner_id, target_id) WHERE deleted_at IS NULL` — a plain unique plus tombstones would make "delete a contact, then re-add them" fail forever — and a CHECK on `ring` (1..4, ONB-04), whose violation otherwise shows up as a mis-placed map node rather than an error.
- **Per-field `*UpdatedAt` columns are load-bearing, not decoration.** The offline outbox replays *stale* mutations, and VLT-08 forbids trusting client clocks; arrival order alone would let a two-hour-old write clobber a five-minute-old one. Record-level `updatedAt` cannot express "ring from A and ressenti from B both survive" (FS-03 acceptance criterion).
- **`Vault` is deprecated, NOT dropped.** `apps/api` still serves `GET/POST /vault` and both clients still call it; dropping it here would break the API build and both apps in one commit. It goes at stage 3/4 with the one-off data migration.
- **Privacy audit:** rows are directional (IDT-08) — a row says how `owner` sees `target`, and no query may select classification columns filtered by `target_id` alone. The seed is deliberately asymmetric (amina→bilal ring 1/positive vs bilal→amina ring 3/ambivalent) so a broken reverse-read cannot pass unnoticed. Nothing new is logged (VLT-03/G3).
- **New devDependency + first tests in this package:** `@electric-sql/pglite` (Postgres as WASM) runs every committed migration and probes the four hand-written invariants — 16 tests, no Docker, no Neon branch. `SUG-DB-004`'s blocker was never a missing plan, it was the belief that a DB test needs infrastructure.
- **Known inconsistency:** new columns are `timestamptz`, pre-existing ones are still `timestamp`. `SUG-DB-008` converts the rest and should land next.

## 2026-08-15 — [SUG-DB-001, IDT-04] EnvieRecipient.recipientId foreign key + right-to-erasure cascade

- Schema: `EnvieRecipient.recipientId` was a bare `String` index; now a `User` relation with explicit `onDelete: Cascade`, plus back-relation `User.envieRecipientOf`. Referential-integrity enforcement and deletion-cascade guarantee per DAT rule 2 (GDPR right-to-erasure).
- Migration: `20260815013200_envie_recipient_user_fk` deletes any orphaned rows (safety check), then `ALTER TABLE … ADD CONSTRAINT envie_recipients_recipient_id_fkey`.
- Seed unchanged — it only inserts rows with existing user ids, so no compatibility issue.
- **Gotcha:** Cascade means a recipient's deletion silently shrinks author recipient-lists (the desired GDPR semantics; do not "preserve" the id elsewhere — defeat erasure). Match rows already cascade via `Match.userA/userB`, so product-visible consistency is preserved.

