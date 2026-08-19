# SUG-REV-002 — No way to tell whether the reviewer is earning its place

- **Area:** review
- **Topic:** quality
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** review-specialist (.claude/agents/review-specialist.md)
- **Related requirement IDs:** — (process)

## Problem / Opportunity

The Code Review Specialist ships with no feedback loop. Nothing records whether a finding was acted on or dismissed, so there is no answer to the only question that matters: **is this agent surfacing things you would have wanted, or is it noise you are learning to scroll past?** Without that number, every future change to the agent — including SUG-REV-001's multi-pass split — is an assumption rather than an improvement, and the failure mode is silent: a reviewer nobody trusts still posts, and its comments quietly stop being read.

Published thresholds give a usable target: **>60%** of findings being ones a reviewer would have wanted means the tool is earning trust; **<40%** means it is adding noise. Roughly 50 PRs is enough signal to judge, and the recommended posture is advisory first — high confidence thresholds, lower volume — loosening only per category as each one earns it.

This also protects against the opposite failure. A reviewer that never blocks anything scores perfectly on precision while catching nothing, so acceptance rate alone is not the metric — escaped defects (bugs found after merge that a review should have caught) must be tracked beside it.

## Implementation plan

1. Add a lightweight ledger — `docs/qa/review-findings.md` or a JSON file beside the E2E manifest — with one row per posted finding: PR number, label, severity, lens (from SUG-REV-001 if landed), and an outcome field: `accepted` / `rejected` / `deferred`.
2. Have the reviewer append its findings at review time; the founder fills the outcome when the PR closes (one word per finding, not a form).
3. Track two numbers, reported together — they only mean something as a pair:
   - **Precision** — `accepted / total`. Target >60%; investigate below 40%.
   - **Escapes** — defects found after merge that the review should have caught. A rising escape count with high precision means the reviewer is too timid, not good.
4. Break precision down by severity and by label so a bad category can be tuned rather than the whole agent distrusted (e.g. `nitpick` running at 20% acceptance is a signal to stop emitting nitpicks, not to distrust `issue (High)`).
5. State the rollout posture in `agents/review-specialist.md`: **advisory only** until ~50 PRs of data exist. Do not gate merges on the reviewer's verdict before then, and record the decision to gate (or not) with the numbers that justified it.
6. Re-check after any change to the agent's rules — the ledger is the regression test for prompt edits.

## Tests & acceptance criteria

- After 10 reviews the ledger holds one row per finding with a recorded outcome, and precision can be computed per severity and per label without manual reconstruction.
- The agent file states the advisory posture and the threshold at which gating would be reconsidered.
- A deliberately noisy run (e.g. temporarily emitting Low findings freely) is visible as a precision drop in the affected label, proving the metric is sensitive enough to be useful.

## Risks & gotchas

- **Keep the founder's cost to one word per finding.** A ledger that needs a form gets abandoned in a week, and an abandoned ledger is worse than none — it reads as data while being stale.
- **Precision alone is gameable**: the trivial way to score 100% is to only ever report things that are obviously true and never block. Always report escapes beside it.
- Small samples lie. Do not tune the agent on 5 findings; wait for the sample and resist reacting to a single annoying comment.
- `docs/qa/` is already shared-allowed by the scope guard, so the ledger is writable from any area's PR — do not put it somewhere only `area:sre` can touch.
