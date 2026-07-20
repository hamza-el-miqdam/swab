# SUG-DB-015 — Stateful models (Match, Proposal, Envie, Device) have no `updatedAt`

- **Area:** db
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** ENV-12, ENV-14 (Data Steward standard: "timestamps createdAt/updatedAt everywhere", agents/data-specialist.md:30)

## Problem / Opportunity

Only `Vault` has `updatedAt` (`packages/db/prisma/schema.prisma:39`). Yet four models carry mutable state whose transition time is otherwise unrecorded:

- `Envie.status` flips ACTIVE→EXPIRED/WITHDRAWN (schema.prisma:78; ENV-12) — the expiry sweep and the 30-day retention sweep (SUG-DB-005) have no "when did it flip" column; the retention window can only be computed from `expiresAt`, which conflates scheduled expiry with actual withdrawal time.
- `Match.state` walks OPEN→PROPOSED→SCHEDULED/EXPIRED (schema.prisma:113) — no transition timestamp for support/debugging or for "quietly reaches EXPIRED later" (ENV-15) sweeps.
- `Proposal.state` PENDING→ACCEPTED/DECLINED/LAPSED (schema.prisma:132; ENV-14) — accept/decline time unrecorded.
- `Device.pushToken` is rotated by push providers (schema.prisma:48) — no way to spot stale devices (useful for pruning dead tokens without content-level data).

Adding it now is a trivial column-add; retrofitting after launch means NULL/backfill ambiguity forever.

## Implementation plan

1. In `schema.prisma`, add to `Envie`, `Match`, `Proposal`, `Device`:
   ```prisma
   updatedAt DateTime @default(now()) @updatedAt @map("updated_at")
   ```
   (append `@db.Timestamptz(3)` if SUG-DB-008 has landed). The `@default(now())` makes the migration clean on existing rows (backfill = now, honest "unknown before this date").
2. One migration `updated_at_stateful_models`.
3. Regenerate client. Seed: no change required (`@updatedAt` is Prisma-managed); optionally pass explicit values where determinism matters for `tests/seed.test.ts` byte-identity — note Prisma overwrites `@updatedAt` on create, so exclude the column from determinism assertions instead.
4. Changelog entry; privacy-audit note: transition timestamps are metadata about server-visible rows, no classification data involved. One caveat to record: `Match.updatedAt` will tick when a pass marker is written (SUG-DB-006) — the counterpart-facing serializer must therefore never include `updatedAt`, or bit-identity (ENV-15) breaks; flag this to `area:api` in the PR.
5. Do NOT add `updatedAt` to `User`, `ContactLink`, `EnvieRecipient` in this pass — they are currently insert-only shapes (schema.prisma:14–29, 56–70, 91–101 have no mutable columns except ContactLink resolution, which SUG-DB-009 already timestamps implicitly via the invite→resolved transition; add there only if product needs it — keep the unused-column discipline symmetrical to unused-index discipline).

## Tests & acceptance criteria

- SUG-DB-004 harness: update an `Envie.status` and assert `updatedAt` advanced while `createdAt` didn't.
- Migration applies to fresh + seeded Postgres; `prisma validate` + turbo gate green.
- ENV-15 guard (once matching exists): counterpart response snapshot excludes `updatedAt` — cover in the api-side bit-identity test.

## Risks & gotchas

- `@updatedAt` is client-side (Prisma sets it) — raw SQL sweeps (expiry cron) must set `updated_at = now()` explicitly; document that in the model comment.
- The ENV-15 serializer caveat in step 4 is the one real hazard — an `updatedAt` leaked into the counterpart's match payload is a covert pass-signal. Make the changelog entry explicit about it.
