# SUG-DB-006 — Single shared `Match.state` cannot represent per-side PASSED (ENV-15)

- **Area:** db
- **Topic:** privacy
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** ENV-15

## Problem / Opportunity

ENV-15 (`docs/specs/FS-05-envie-match.md:43`): "« Passer cette fois » sets PASSED **for the passer only**. The counterpart's views/API responses remain bit-identical to a still-open match … their side quietly reaches EXPIRED later."

The schema models this with one shared column:

- `packages/db/prisma/schema.prisma:113` — `state MatchState @default(OPEN)` (single value for both sides).
- `packages/db/prisma/schema.prisma:154–163` — `MatchState { OPEN PROPOSED SCHEDULED PASSED EXPIRED }` with the comment "PASSED is private to the passer — the counterpart's reads are bit-identical either way."

Two defects:

1. **Lossy:** setting `state = PASSED` records that *someone* passed but not *who* — the server cannot render the passer's view (PASSED) vs the counterpart's view (still OPEN/PROPOSED) from this column, and it destroys the pre-pass state (was the counterpart mid-proposal?). The comment's promise is unimplementable with the current shape.
2. **Privacy-adjacent:** any accidental serialization of `state` to the counterpart (one forgotten `select`) leaks the pass. Per-side columns make the safe query the natural one.

Matching is not yet implemented in `apps/api` (only auth/vault/health routes exist), so this is a cheap pre-implementation redesign.

## Implementation plan

1. In `packages/db/prisma/schema.prisma`, model `Match`:
   - Remove `PASSED` from `MatchState` (shared lifecycle becomes `OPEN PROPOSED SCHEDULED EXPIRED`).
   - Add per-side nullable pass markers:
     ```prisma
     passedByAAt DateTime? @map("passed_by_a_at") // A's private soft-exit (ENV-15); never serialized to B
     passedByBAt DateTime? @map("passed_by_b_at")
     ```
2. Document on the model: a side's *view state* = `passedBy<side>At != null ? PASSED : state`; the counterpart's responses must be computed from `state` alone (bit-identical, ENV-15).
3. Migration `match_per_side_pass`: add the two columns; removing an enum value in Postgres requires recreate — since no production data exists, the migration can `ALTER TYPE`-recreate `match_state` without `PASSED` (or, if SUG-DB-002's baseline hasn't shipped, fold into the baseline). If any row had `state = 'PASSED'` it must first be mapped (none can exist today — no writer code).
4. Regenerate client; update `packages/db/prisma/seed.ts` (its match uses `MatchState.OPEN`, seed.ts:132 — unaffected; add a passed-by-one-side sample row per SUG-DB-014).
5. PR note to `area:api`: `POST /matches/:id/pass` (swab-domain-spec.md:160) writes the caller's `passedBy*At` only; GET responses for the counterpart must not select these columns.
6. Changelog entry citing ENV-15 with a privacy-audit note (pass markers are per-user timestamps, not classification data — allowed server-side, but excluded from the counterpart's payloads).

## Tests & acceptance criteria

- Constraint/behavior test (SUG-DB-004 harness): set `passedByAAt`; assert `state` unchanged and a counterpart-shaped `select { state, notifiedAt, createdAt }` returns values identical to before the pass (bit-identical contract, `test_ENV15_pass_invisible_to_counterpart`).
- Migration applies cleanly on fresh Postgres; `prisma validate` green; typecheck green after regeneration.

## Risks & gotchas

- Enum value removal is the only mildly destructive step — safe now precisely because no code writes matches yet; after matching ships this becomes an expand→migrate→contract, so do it first.
- Do not model pass as a `Proposal`-like child row keyed by userId: it doubles query cost on the hot match-list path and makes the accidental-leak query (a join) easier to write, not harder.
- Keep `EXPIRED` in the shared enum — the "quietly reaches EXPIRED later" path (ENV-15) is the shared terminal state both sides may observe.
