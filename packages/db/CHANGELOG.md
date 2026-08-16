# Changelog — packages/db (area:db)

> Newest first. One entry per schema/seed/migration change. **Only the Data Steward writes here** (same rule as `schema.prisma`).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: model diff summary, motivating query patterns, privacy-audit note.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

> Entries before 2026-08-15 are archived in [../../docs/archive/db-CHANGELOG-pre-2026-08-15.md](../../docs/archive/db-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

## 2026-08-15 — [SUG-DB-001, IDT-04] EnvieRecipient.recipientId foreign key + right-to-erasure cascade

- Schema: `EnvieRecipient.recipientId` was a bare `String` index; now a `User` relation with explicit `onDelete: Cascade`, plus back-relation `User.envieRecipientOf`. Referential-integrity enforcement and deletion-cascade guarantee per DAT rule 2 (GDPR right-to-erasure).
- Migration: `20260815013200_envie_recipient_user_fk` deletes any orphaned rows (safety check), then `ALTER TABLE … ADD CONSTRAINT envie_recipients_recipient_id_fkey`.
- Seed unchanged — it only inserts rows with existing user ids, so no compatibility issue.
- **Gotcha:** Cascade means a recipient's deletion silently shrinks author recipient-lists (the desired GDPR semantics; do not "preserve" the id elsewhere — defeat erasure). Match rows already cascade via `Match.userA/userB`, so product-visible consistency is preserved.

