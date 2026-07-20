# SUG-SPEC-012 — ENV-13 "exactly three actions" conflicts with ENV-14's accept/decline; proposal payload allows an empty proposal

- **Area:** specs
- **Topic:** requirements
- **Impact:** low
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** ENV-13, ENV-14

## Problem / Opportunity

1. **"Exactly three" vs accept/decline.** ENV-13: "Match surface offers exactly: **Proposer un lieu**, **Proposer une heure**, **Passer cette fois**" (`docs/specs/FS-05-envie-match.md:41`). ENV-14: proposals "go to the counterpart, who **accepts/declines**" (`FS-05:42`). The counterpart's accept/decline actions must render somewhere — presumably the same match surface — which then offers five actions, contradicting "exactly three". The spec-kit artifact hardens the contradiction into a test: "**exactly three actions** are available … **no other actions**" (`specs/001-envie-match/spec.md:60`, US3 scenario 1, citing ENV-13 *and* ENV-14). A literal implementation of that scenario makes accepting a proposal impossible. The unstated intent is presumably state-dependent (three actions on an OPEN match with no incoming proposal; accept/decline when one is pending) — but no text says so.
2. **Empty proposal is representable.** The API contract allows `POST /matches/:id/proposals (place?, timeslot?)` with both fields optional (`FS-05:48`); nothing requires at least one of place/timeslot. ENV-13's actions imply one or the other is chosen, but the seam contract (which is "normative once generated", `FS-05:46`) would pass an empty proposal today.
3. Minor: whether one proposal may carry *both* place and timeslot is also undefined ("place and/or time", `FS-05:42` says and/or — fine, but the "exactly three actions" UI has no combined action, so how a both-fields proposal is authored is unspecified).

## Implementation plan

1. Amend ENV-13 (`FS-05:41`): "Match surface **in the OPEN state with no pending incoming proposal** offers exactly: Proposer un lieu, Proposer une heure, Passer cette fois — copy per blueprint. With a pending incoming proposal, the surface offers exactly: accept, decline, Passer cette fois (copy for accept/decline per blueprint — if the blueprint lacks it, raise as missing copy per playbook §4 rule 5, do not invent)."
2. Amend ENV-14 (`FS-05:42`): append "A proposal MUST carry at least one of {place, timeslot}; the API rejects an empty proposal (422)."
3. Re-sync `specs/001-envie-match/spec.md`: scenario US3-1 (`spec.md:60`) and FR-013/FR-014 (`spec.md:89-90`) to match the state-dependent wording.
4. Root `CHANGELOG.md` entry (`area:specs`); notion-liaison re-sync for FS-05.

## Tests & acceptance criteria

- A reader can enumerate the full action set for every match state (OPEN/no-proposal, OPEN/incoming-proposal, SCHEDULED, PASSED-own-side) without guessing.
- Backend test derivable from the new ENV-14 sentence: `test_ENV14_emptyProposal_rejected422`.
- The future ENV-13 E2E scenario asserts per-state action sets instead of an unconditional "exactly three".

## Risks & gotchas

- The accept/decline French copy does not exist in the specs — step 1 deliberately routes it through the missing-copy protocol rather than inventing it (hard boundary: French copy verbatim from specs/blueprints).
- Whether "Passer cette fois" remains available while a proposal is pending is a genuine product question; the wording above assumes yes (graceful exit is a product law) — flag it in the PR for explicit confirmation rather than burying it.
- Keep the change ahead of `/speckit-plan` for 001-envie-match to avoid downstream artifact churn.
