# SUG-DB-007 — FK columns without indexes: Device.userId, Envie.authorId, Match.userA/B + envieBId, Proposal.matchId/proposerId, ContactLink.targetId

- **Area:** db
- **Topic:** performance
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** IDT-04 (cascade cost), IDT-05 (device push fanout); match-list API per swab-domain-spec.md §5

## Problem / Opportunity

Postgres does not auto-index FK referencing columns, and Prisma only creates indexes you declare. The schema declares exactly three secondary indexes (`packages/db/prisma/schema.prisma:68, 86, 99`); every other FK column is unindexed:

- `Device.userId` (schema.prisma:46–47) — "devices for user" is the push-notification fanout (IDT-05) and the `onDelete: Cascade` scan on user deletion.
- `Envie.authorId` (schema.prisma:74–75) — "my active envies" listing with withdraw option (ENV-06, `docs/specs/FS-05-envie-match.md:24`) and user-deletion cascade. The existing `@@index([category, status, expiresAt])` (schema.prisma:86) does not cover author lookups.
- `Match.userAId` / `Match.userBId` (schema.prisma:109, 111) — `GET /matches` (swab-domain-spec.md:160) is `WHERE user_a_id = ? OR user_b_id = ?`; both sides need indexes, plus the user-deletion cascade.
- `Match.envieBId` (schema.prisma:107) — `@@unique([envieAId, envieBId])` (schema.prisma:120) serves `envieAId`-prefix lookups only; envie deletion via the `envieB` relation scans.
- `Proposal.matchId` and `Proposal.proposerId` (schema.prisma:126, 128) — proposals-for-match reads (ENV-14) and both cascades.
- `ContactLink.targetId` (schema.prisma:60) — `onDelete: SetNull` (schema.prisma:61) must find rows by target on every user deletion; also the "who links to me" resolution when pending invites attach (IDT-07). `@@unique([ownerId, targetId])` covers only owner-prefix lookups.

At seed scale this is invisible; at product scale every user deletion and match-list request degrades to sequential scans (deletion touches 7 tables — data-specialist.md rule 2 makes deletion a feature that "never breaks").

## Implementation plan

1. In `packages/db/prisma/schema.prisma`, add — each with the required "named query pattern" comment (data-specialist.md:30):
   - `Device`: `@@index([userId])` — push fanout + deletion cascade.
   - `Envie`: `@@index([authorId, status])` — "my active envies" (ENV-06) and cascade (leftmost prefix serves bare authorId).
   - `Match`: `@@index([userAId])`, `@@index([userBId])`, `@@index([envieBId])` — match list per side + cascades.
   - `Proposal`: `@@index([matchId])`, `@@index([proposerId])` — proposals-for-match + cascades.
   - `ContactLink`: `@@index([targetId])` — SetNull scan + pending-link resolution (IDT-07).
2. `prisma validate`, then one migration `fk_indexes` (pure `CREATE INDEX` statements — non-destructive).
3. Regenerate client (no type changes); seed unaffected.
4. Changelog entry listing each index with its query pattern (satisfies the "unused-index review" discipline).

## Tests & acceptance criteria

- Migration applies to fresh `postgres:17` (SUG-DB-002 CI check) and to a seeded database.
- Optional but cheap (SUG-DB-004 harness): `EXPLAIN` assertion that `SELECT * FROM matches WHERE user_b_id = $1` uses an Index Scan on the seeded DB with `SET enable_seqscan = off` sanity check — or simply assert the indexes exist via `pg_indexes`.
- `pnpm turbo run lint typecheck test build` green.

## Risks & gotchas

- Index writes cost on the hot envie-creation path are negligible at POC scale, but keep the "every index exists for a named query pattern" comment discipline so future unused-index reviews can prune.
- Do not add an index on `EnvieRecipient.envieId` — it's the leading column of the composite PK (schema.prisma:97), already covered.
- If SUG-DB-001 lands (recipientId FK), its existing `@@index([recipientId])` (schema.prisma:99) already covers that cascade — no extra index needed.
