# SUG-SPEC-007 — FS-03 shipped with taxonomy open questions unresolved; « en pause » axis ambiguity never promoted to an OQ

- **Area:** specs
- **Topic:** requirements
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md) — name notion-liaison-specialist for the mirror
- **Related requirement IDs:** FCH-01, FCH-06, FLT-01, OQ-FCH-1

## Problem / Opportunity

1. **OQ-FCH-1 is stale relative to reality.** `docs/specs/FS-03-contact-card.md:36` still reads: "exact vocabulary sets for Rôles·contexte and Ressenti … Architect to extract with Hamza **before implementation**; placeholder taxonomies acceptable for the walking skeleton." FS-03 is now `Implemented` (`FS-03:3`; `docs/STATUS.md:18` 🟢) — implementation happened, presumably on placeholders, and the OQ text still describes a pre-implementation world. Nothing records which taxonomy actually shipped or that it is placeholder data users would build vaults on (a later vocabulary change becomes a vault migration).
2. **The « en pause » axis divergence is a known ambiguity with no OQ.** Three QA/status documents flag it: `docs/qa/e2e-coverage.json:165` ("The état-vs-ressenti axis ambiguity for « en pause » remains flagged (Wave 3)"), `docs/qa/e2e-scenarios.md:160` ("both axes checked until resolved"), `docs/STATUS.md:18` ("`en pause` taxonomy divergence documented"). The specs themselves are consistent (FCH-06 `FS-03:24` and FLT-01 `docs/specs/FS-06-filtering.md:21` both treat `en pause` as **état**), but the divergence lives only in QA notes — playbook §7 requires "Every open question (OQ-*) in the specs is tracked as a `question` issue owned by the Architect — agents never resolve OQs implicitly through code." FS-06 is unbuilt and its shipped default rule (FLT-01) hinges on which axis `en pause` lives on; if the platforms diverge from the spec, FS-06's implementer inherits the confusion.

## Implementation plan

1. Update `docs/specs/FS-03-contact-card.md:36` (OQ-FCH-1) to reflect reality: "OQ-FCH-1 (**still open post-implementation**): FS-03 shipped 2026-07-10 with placeholder vocabulary sets for Rôles·contexte and Ressenti. Final vocabularies still need extraction from the blueprint with Hamza; changing them later is a vault-content migration (existing user tags must map forward) — resolve before external testers."
2. Add `OQ-FCH-2` to FS-03's Open questions: "Platform implementations flagged an état-vs-ressenti axis ambiguity for « en pause » in Wave 3 (see `docs/qa/e2e-coverage.json` FCH-06 note). The spec's position is état (FCH-06, FLT-01) — audit both native apps against this and either fix the implementations or amend the spec, **before FS-06 implementation starts** (its default rule targets état = en pause)."
3. Per playbook §7, both OQs become `question` issues owned by the Architect — note this in the PR description.
4. Root `CHANGELOG.md` entry (`area:specs`); notion-liaison re-sync for FS-03's Open questions section.

## Tests & acceptance criteria

- FS-03's Open questions section no longer claims a pre-implementation state for an Implemented spec.
- The `en pause` ambiguity is discoverable from the spec itself (grep `OQ-FCH-2`), not only from QA side-notes.
- FS-06 readiness check (playbook §5 "Ready") can now cite OQ-FCH-2 as an explicit dependency to clear.

## Risks & gotchas

- Do NOT resolve either question in this PR — the vocabulary and the axis decision are product calls (G4: "do not guess product behavior").
- The vault-migration consequence in step 1 is the load-bearing warning: placeholders feel free until real users have tagged contacts.
- Notion mirror: Open-questions sections are mirrored; the co-founder should see these two questions — they are addressed to him.
