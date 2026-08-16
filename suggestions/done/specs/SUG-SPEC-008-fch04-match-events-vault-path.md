# SUG-SPEC-008 — FCH-04's "match events in the history feed" has no specified path into the vault

- **Area:** specs
- **Topic:** requirements
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** FCH-04, ENV-10/ENV-13 (FS-05 post-match), VLT-01

## Problem / Opportunity

FCH-04 (`docs/specs/FS-03-contact-card.md:22`) requires: "History feed shows axis changes and relationship events (**matches with this person, at coarse grain**) over 12 months, newest first, **sourced from the vault only**." Two gaps:

1. **No requirement anywhere writes match events into the vault.** Matches are created server-side (ENV-08/09/10, `docs/specs/FS-05-envie-match.md:31-33`); the vault is written on-device (VLT-01, `docs/specs/FS-07-identity-vault.md:32`). FS-05's mobile requirements (ENV-01..07, ENV-13..16) contain no "on match, append a history event to the vault for that contact" step. So FCH-04's data source is specified as vault-only, but no spec makes the data reach the vault — the seam falls between FS-03 (Implemented) and FS-05 (unbuilt), and the FS-05 implementer has no requirement telling them to do it. The coverage manifest confirms the hole: "Match events not yet testable — FS-05 not implemented" (`docs/qa/e2e-coverage.json:151`).
2. **"Coarse grain" is undefined.** Does a coarse event carry the category? the date only? the verb (which would put an envie verb into vault history — allowed, since the vault is private, but it should be a decision, not an accident)?

Additionally, FS-03 is 🟢 "Implemented (spec acceptance tests green)" (`docs/STATUS.md:18,23`) while one clause of FCH-04 is explicitly deferred ("FCH-04 match events deferred pending FS-04/05", `docs/STATUS.md:18`) — a small status-honesty wrinkle worth one sentence in the spec so the deferral is visible where the requirement lives.

## Implementation plan

1. Add a row to FS-05's Post-match table (`docs/specs/FS-05-envie-match.md`, after ENV-16), e.g.: `ENV-19 | On receiving a match notification, the client appends a coarse-grain relationship event to the local vault history for the matched contact — proposed grain: {date, category} only, never the verb ⚠️ PROPOSED ASSUMPTION — feeding FCH-04. Server keeps no per-relation history beyond the Match row.` (Use the next free ID if SUG-SPEC-006's ENV-17/18 land first.)
2. Amend FCH-04 (`docs/specs/FS-03-contact-card.md:22`): append "(match events are written by the FS-05 client per ENV-19; grain defined there — deferred until FS-05 lands)".
3. The `{date, category}` grain is a ⚠️ PROPOSED ASSUMPTION — run it through the playbook §7 approval flow; if approved, no product-overview change needed (it is spec-local).
4. Update the coverage entry only when FS-05 lands (no manifest change now — the current note is honest).
5. Root `CHANGELOG.md` entry (`area:specs`); notion-liaison re-sync for FS-03/FS-05.

## Tests & acceptance criteria

- Traceability closes: FCH-04's "match events" clause now cites the producing requirement, and FS-05 contains it.
- When FS-05 is implemented, the FCH-04 E2E scenario can extend to assert a match appears in the fiche history (test name carries both IDs, e.g. `test_ENV19_FCH04_matchAppendsCoarseHistoryEvent`).
- Grep check: "coarse grain" in FS-03 now resolves to a definition instead of dangling.

## Risks & gotchas

- The grain decision has privacy weight even though the vault is private: including the verb means envie text persists for 12 months on-device — fine technically, but it is a product-tone call (calm by design) → keep it as a flagged assumption for Hamza.
- FS-03's implemented history model on both platforms may need a new event type — coordinate so the vault blob shape change gets a backward-compat guard like the Wave-3 legacy-blob tests (`docs/qa/e2e-scenarios.md:242`).
