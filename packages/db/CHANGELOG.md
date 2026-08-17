# Changelog — packages/db (area:db)

> Newest first. One entry per schema/seed/migration change. **Only the Data Steward writes here** (same rule as `schema.prisma`).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: model diff summary, motivating query patterns, privacy-audit note.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

> Entries before 2026-08-15 are archived in [../../docs/archive/db-CHANGELOG-pre-2026-08-15.md](../../docs/archive/db-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

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

