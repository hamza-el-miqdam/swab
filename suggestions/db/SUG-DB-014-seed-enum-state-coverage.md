# SUG-DB-014 — Seed covers 5 of 14 enum states and no match-race edge cases

- **Area:** db
- **Topic:** testing
- **Impact:** low
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** ENV-12, ENV-14, ENV-15 (Data Steward project rule 4)

## Problem / Opportunity

`agents/data-specialist.md:38` (rule 4): seed data "covers all enum states and the match-race edge cases". Current coverage in `packages/db/prisma/seed.ts`:

- `EnvieStatus`: ACTIVE (seed.ts:102, 119) and EXPIRED (seed.ts:155) — **WITHDRAWN missing** (ENV-06/ENV-12 withdraw path has no fixture).
- `MatchState`: only OPEN (seed.ts:132) — **PROPOSED, SCHEDULED, PASSED, EXPIRED missing** (ENV-14/ENV-15 flows have no fixtures; note SUG-DB-006 redesigns PASSED — align with whichever shape lands).
- `ProposalState`: only PENDING (seed.ts:145) — **ACCEPTED, DECLINED, LAPSED missing**.
- `Platform`: IOS and ANDROID (seed.ts:67, 70) — **WEB missing**.
- Match-race edge cases (rule 4 + ENV-12 "existing matches survive"): no fixture for a match whose envie has since expired/withdrawn, no same-category-but-one-sided pair (near-miss that must NOT match — the negative case E2E and matching tests need).

Previews and future E2E suites run on this seed — uncovered states mean UI states (withdrawn list, scheduled match, declined proposal) can only be tested by hand-crafting data per test.

## Implementation plan

All edits in `packages/db/prisma/seed.ts`, keeping the deterministic fixed-clock style (T0/hoursFromT0, seed.ts:27–31) and the counts-only summary (seed.ts:163–173):

1. Add a WITHDRAWN envie for Daoud (`status: EnvieStatus.WITHDRAWN`, recipients including Bilal) — exercises ENV-12's "can no longer produce matches".
2. Add a second reciprocal pair (Emna/Farid, category "cinema") whose match is `SCHEDULED`, with its proposal `ACCEPTED` — exercises ENV-14 happy path end-to-end.
3. Add a `DECLINED` and a `LAPSED` proposal on the existing Amina/Bilal match (multiple proposals per match are legal — `Match.proposals Proposal[]`, `packages/db/prisma/schema.prisma:116`).
4. Add a WEB-platform device for Chirine (`Platform.WEB`, `pushToken: null`).
5. Add the near-miss pair: Chirine ACTIVE envie category "sport" naming Daoud, Daoud ACTIVE envie category "food" naming Chirine — same users, mismatched category, NO match row (negative fixture for ENV-08).
6. Add a survived match: envie pair where one envie is now EXPIRED but the match row persists (ENV-12) — state per SUG-DB-006 outcome.
7. Update the header comment (seed.ts:4–7) enumerating coverage; keep total rows tiny (<50 — free-tier rule 4).
8. Changelog entry.

## Tests & acceptance criteria

- `pnpm --filter @repo/db db:seed` green; summary counts updated and asserted in `tests/seed.test.ts` (SUG-DB-004).
- Assertion: every member of `EnvieStatus`, `MatchState`, `ProposalState`, `Platform` appears at least once in the seeded DB (`SELECT DISTINCT` per enum column) — this test enforces rule 4 permanently.
- Seed remains idempotent (wipe-then-create) and deterministic (byte-identical rows across two runs, ids excepted).

## Risks & gotchas

- Sequence with SUG-DB-003 (canonical envie ordering — new match fixtures must sort pair ids) and SUG-DB-006 (PASSED becomes per-side timestamps — fixture 6 uses the new columns). Land those first or adapt.
- Rule 4 mentions "faker with a fixed seed"; the current no-faker deterministic approach is stricter and adds no dependency — keep it (note the deviation in the changelog once, deliberately; G4 discourages new deps).
- The near-miss fixture must never satisfy ENV-08 — if a future matching engine backfills matches from seed data, this pair is the canary.
