# SUG-DB-001 — EnvieRecipient.recipientId has no FK to User — breaks GDPR cascade erasure

- **Area:** db
- **Topic:** integrity
- **Impact:** high
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** IDT-04 (Data Steward project rule 2)

## Problem / Opportunity

`EnvieRecipient.recipientId` is a bare `String` with an index but **no relation to `User`**:

- `packages/db/prisma/schema.prisma:94` — `recipientId String @map("recipient_id")` (no `recipient User @relation(...)` line anywhere in the model, lines 91–101).
- The `User` model (schema.prisma:14–29) has back-relations for vault, devices, linksOut/linksIn, envies, matchesA/B, proposals — but **none** for envie-recipient rows.

Consequences:

1. **Right-to-erasure violation (IDT-04, `agents/data-specialist.md` rule 2: "account deletion must cascade to everything … including EnvieRecipient, zero orphaned rows").** Deleting a user cascades their own envies (and those envies' recipient rows), but rows where the deleted user is the *recipient* of someone else's envie survive forever, keeping the deleted user's id in other users' recipient lists.
2. No referential integrity: nothing prevents inserting a recipient id that never existed (matching engine would silently target ghosts).

The same omission exists in the draft it was copied from (`swab-domain-spec.md:110–118`), so it is inherited, not intentional — the spec's privacy §2 only requires "final resolved recipient list", which an FK does not change.

## Implementation plan

1. In `packages/db/prisma/schema.prisma`, model `EnvieRecipient`, replace the bare field with a relation:
   ```prisma
   recipientId String @map("recipient_id")
   recipient   User   @relation("envieRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
   ```
2. In model `User`, add the back-relation: `envieRecipientOf EnvieRecipient[] @relation("envieRecipient")`.
3. Keep the existing `@@index([recipientId])` (schema.prisma:99) — it now also serves the FK cascade scan.
4. Decision to record in the changelog: `onDelete: Cascade` (row disappears from the author's recipient list) is the erasure-correct choice; `Restrict` would block deletion and `SetNull` is impossible (field is part of `@@id([envieId, recipientId])`, schema.prisma:97).
5. `pnpm --filter @repo/db exec prisma validate`, then create the migration (`prisma migrate dev --name envie_recipient_user_fk` — or fold into the baseline init migration if SUG-DB-002 lands first; preferred order: 002 then this).
6. Regenerate client (`pnpm --filter @repo/db db:generate`); seed needs no change (it only inserts existing user ids, `packages/db/prisma/seed.ts:107–122`).
7. Append `packages/db/CHANGELOG.md` entry.

## Tests & acceptance criteria

- Deletion-cascade integration test (see SUG-DB-004 for harness): create users A,B; A sends an envie to B; `prisma.user.delete({ where: { id: B } })`; assert `envieRecipient.count()` for `recipientId = B` is 0 and no FK error. This is the "zero orphaned rows for a deleted user" test required by data-specialist rule 2.
- Constraint test: inserting an `EnvieRecipient` with a nonexistent `recipientId` rejects with a FK violation.
- `prisma validate` green; `pnpm turbo run typecheck test build` green.

## Risks & gotchas

- Applying the FK to an existing database with orphaned recipient rows will fail — delete orphans first in the migration SQL (`DELETE FROM envie_recipients WHERE recipient_id NOT IN (SELECT id FROM users);`). On fresh/dev branches this is a no-op.
- Cascade means an author's stored recipient list silently shrinks when a recipient deletes their account — that is the desired erasure semantics; do not "preserve" the id anywhere (would defeat erasure).
- Match rows referencing the deleted user already cascade via `Match.userA/userB` (schema.prisma:110–112), so no product-visible inconsistency is introduced.
