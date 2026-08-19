# SUG-REV-001 — Single-pass review under-reports: add focused passes with a synthesizer

- **Area:** review
- **Topic:** quality
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** review-specialist (.claude/agents/review-specialist.md)
- **Related requirement IDs:** — (process; supports G1/G2 enforcement)

## Problem / Opportunity

`agents/review-specialist.md` runs the whole review in one pass: freshness, spec fidelity, E2E, diff coverage, privacy, CI blind spots, then a verdict. One pass over a long checklist has a known failure shape — attention concentrates on whatever the diff foregrounds, and the dimensions that require *looking for an absence* (a missing test, an un-updated seed, a privacy leak by omission) are the first to be skipped. A small diff quietly loses its security pass because nothing in it looked security-shaped.

Published practice is consistent on the fix. Cursor's BugBot runs 8 parallel passes over the same diff with randomized ordering and majority voting, moving its finding-resolution rate from 52% to >70%. The general pattern is narrow specialist passes — security, tests, architecture, performance — each with its own prompt, followed by a synthesizer that de-duplicates, ranks by severity and confidence, and posts **one** review.

Two Swab-specific reasons this matters more than usual:

1. Almost every PR is agent-authored, so review is the only place a human-grade objection enters the pipeline.
2. The gates that matter most here (G1 privacy, G2 coverage, the E2E drift guard) are all absence-detection — exactly what a single pass degrades on.

## Implementation plan

1. Split the existing checklist into 3 focused passes over the same diff, each stated as its own prompt with its own success criteria:
   - **Correctness & contracts** — logic, error paths, invented APIs, behavior changes hiding behind green types.
   - **Privacy & security (G1)** — logging of verbs/recipients/phone hashes/push tokens, directional privacy (IDT-08), mutual-reveal, secrets, input validation at boundaries.
   - **Tests & gates (G2/G5)** — spec/`SUG-*.md` fidelity, diff coverage, E2E report + manifest drift, changelog and `docs/STATUS.md` duties.
2. Run the passes independently — no pass sees another's findings, so a weak signal is not suppressed by an earlier confident miss.
3. Add a **synthesizer** step: merge findings, drop duplicates, keep the highest severity when two passes describe one defect, sort Critical → Low, and post a single review. Conflicting conclusions between passes are surfaced as an explicit uncertainty note, never silently resolved.
4. Record per-pass provenance on each finding (which lens raised it) so SUG-REV-002's metric can tell which passes earn their cost.
5. Document the cost/benefit in the agent file: 3 passes is roughly 3× the tokens of one. State when a single pass is acceptable (docs-only, lockfile-only, generated-render-only diffs).

## Tests & acceptance criteria

- On a PR with a deliberately planted defect in each lens (an untested new branch, a `logger.info` carrying an envie verb, a `SUG-*.md` plan step silently skipped), all three are reported in one synthesized review — the current single pass is expected to miss at least one; capture that before/after as the justification.
- No duplicate findings in the posted review when two passes describe the same defect.
- Review output stays one comment thread per finding — passes are an internal mechanism, never visible as three separate reviews.

## Risks & gotchas

- **Token cost is the real constraint** for a solo founder; measure before making it the default, and consider reserving multi-pass for PRs touching `apps/`/`packages/` while docs-only PRs stay single-pass.
- **Do not scale passes with diff size.** The finding above is precisely that small diffs lose their specialist passes — a 20-line change to auth deserves the privacy pass most.
- Independence is the whole mechanism: if the passes share context, this collapses into one pass with extra steps.
- Depends on nothing, but is best landed *after* SUG-REV-002 so the improvement is measurable rather than assumed.
