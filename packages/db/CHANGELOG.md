# Changelog — packages/db (area:db)

> Newest first. One entry per schema/seed/migration change. **Only the Data Steward writes here** (same rule as `schema.prisma`).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: model diff summary, motivating query patterns, privacy-audit note.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

> Entries before 2026-08-15 are archived in [../../docs/archive/db-CHANGELOG-pre-2026-08-15.md](../../docs/archive/db-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

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

