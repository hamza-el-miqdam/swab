# SUG-SPEC-009 — The number of intimacy rings is specified nowhere, while tests and a known bug assume four

- **Area:** specs
- **Topic:** requirements
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** ONB-04, MAP-01, FCH-01 (Intimité axis)

## Problem / Opportunity

The intimacy ring is the core spatial primitive (ONB-04 `docs/specs/FS-01-onboarding.md:23`, MAP-01 `docs/specs/FS-02-relationship-map.md:19`, glossary `docs/product-overview.md:35`), yet **no spec states how many rings exist or what each means**. Every mention says "an intimacy ring" / "its declared intimacy ring" — the count and semantics live only in the blueprint, outside the requirement system.

Meanwhile the QA surface has silently committed to four: `docs/qa/e2e-coverage.json:29` — "Rings 1/2 only — E2EFlows/OnboardingFlow hard-fail on **rings 3/4** (open CalibrateScreen text-wrap bug, tracked since Wave 2)" — and `docs/qa/e2e-scenarios.md:47` repeats it. Consequences:

- ONB-04 is classified `automated` while half the ring set is deliberately excluded from coverage; the note is honest, but the spec gives no basis to even say what "full ring coverage" would be.
- Both platforms could legitimately ship different ring counts without violating any requirement ID — a cross-platform consistency hole for the product's central metaphor.
- FS-04's SGR-01 uses "intimacy ring as an attribute" of FCA (`docs/specs/FS-04-subgroups.md:19`) — determinism across platforms (and shared test vectors per SUG-SPEC-005) needs a fixed ring enumeration.

## Implementation plan

1. Extract the normative ring count and labels from the Onboarding blueprint (`blueprints/`, `swab - Onboarding (standalone)` per `FS-01:3`) — the implemented apps evidently use 4; verify against the blueprint before writing.
2. Amend ONB-04 (`docs/specs/FS-01-onboarding.md:23`): after "assigns it to an intimacy ring", insert "(N rings, from the blueprint: ⟨list ring labels verbatim⟩ — the fixed enumeration shared by FS-02/FS-03/FS-04)". If the blueprint is ambiguous about N, instead add `OQ-ONB-1` recording the question and the de-facto N=4 — never invent the labels.
3. Cross-reference rather than duplicate: in MAP-01 and the FS-03 Intimité axis, add "(ring enumeration per ONB-04)".
4. No coverage manifest change needed now (the ONB-04 note already discloses the rings-3/4 exclusion honestly); once the CalibrateScreen text-wrap bug (`docs/STATUS.md:9`) is fixed, extend the ONB-04 tests to all rings and drop the note — mention this follow-up in the changelog entry.
5. Root `CHANGELOG.md` entry (`area:specs`); notion-liaison re-sync for FS-01.

## Tests & acceptance criteria

- `grep -rn "ring" docs/specs/ | grep -i "4\|four\|N rings"` shows exactly one normative definition (ONB-04) and cross-references elsewhere — single source of truth.
- The E2E scenario for ONB-04 can now state "all N rings" as its target coverage instead of an unstated set.
- FS-04 shared test vectors (when written) can enumerate ring attribute values from the spec.

## Risks & gotchas

- The ring labels are frozen French copy — they must come from the blueprint verbatim (playbook §4 rule 5), never paraphrased.
- If iOS and Android shipped different ring counts/labels (possible, given no requirement pinned them), that discovery becomes platform bug reports, not a spec retrofit to whichever shipped — check both apps' calibration screens before writing N.
- Notion mirror: the glossary/co-founder-visible pages mention rings; keep the mirror consistent.
