# SUG-SPEC-013 — Wording-precision fixes: ONB-02's IDT range, FCH-05 "configurable", ENV-15's "modulo timestamps"

- **Area:** specs
- **Topic:** requirements
- **Impact:** low
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** ONB-02, FCH-05, ENV-15

## Problem / Opportunity

Three small but real precision defects in normative text:

1. **ONB-02 cites the wrong IDT range.** "Phone-OTP signup per FS-07 (IDT-01…04)" (`docs/specs/FS-01-onboarding.md:22`). IDT-04 is account deletion with 7-day grace (`docs/specs/FS-07-identity-vault.md:16`) — nothing to do with signup. The signup/session/throttle set is IDT-01…03 (`FS-07:13-15`). A traceability grep from IDT-04 today falsely pulls in onboarding.
2. **FCH-05's "configurable period" has no configurer.** "if no axis changed for a configurable period (default 6 months ⚠️ ASSUMPTION)" (`docs/specs/FS-03-contact-card.md:23`). No spec defines a surface where anyone configures it — FS-03 has no settings requirement, FS-06's settings surface covers filter rules only (`docs/specs/FS-06-filtering.md:25`). FS-03 is Implemented; either a config surface exists undocumented, or "configurable" is dead weight that will make a future auditor hunt for a nonexistent setting. "Calm by design" also argues against exposing a staleness knob.
3. **ENV-15's equality bound is untestable as written.** The acceptance criterion says the counterpart's response must be "byte-equivalent (**modulo timestamps**) to the pre-pass response" (`docs/specs/FS-05-envie-match.md:54`); the spec-kit artifact repeats "bit-identical (modulo timestamps)" (`specs/001-envie-match/spec.md:62,91`). Which timestamp fields are exempt is unstated — `Match.notifiedAt`? `createdAt`? proposal timestamps? An exemption list that the test doesn't pin can silently grow to hide a real leak (e.g. an `updatedAt` that ticks on pass would be "a timestamp" yet is exactly the observable signal ENV-15 forbids).

## Implementation plan

1. `docs/specs/FS-01-onboarding.md:22`: change "(IDT-01…04)" to "(IDT-01…03)".
2. `docs/specs/FS-03-contact-card.md:23`: change "a configurable period (default 6 months ⚠️ ASSUMPTION)" to "a fixed period (6 months ⚠️ ASSUMPTION; a user-facing setting is deliberately out of scope — revisit only if testers ask)". First verify neither native app actually shipped a setting (grep the two apps for the staleness constant); if one did, document that surface instead — do not delete a real feature from the spec.
3. `docs/specs/FS-05-envie-match.md:54`: change "(modulo timestamps)" to "(identical field set and values; the ONLY permitted differences are server-clock response metadata — no entity field, including updatedAt-style columns, may change on the counterpart's side because of a pass)". Mirror the same wording in `specs/001-envie-match/spec.md:62` (US3 scenario 3) and `spec.md:91` (FR-015).
4. Root `CHANGELOG.md` entry (`area:specs`); notion-liaison re-sync for the FS-01/FS-03/FS-05 sentences.

## Tests & acceptance criteria

- Grep traceability: IDT-04 is referenced only by deletion-related text; ONB-02 references exactly the requirements it depends on.
- The future ENV-15 response-shape-equality test (playbook §6 audit item 4) can be written directly from the criterion with no interpretive choices about exempt fields.
- FCH-05 text matches shipped behavior on both platforms (checked in step 2).

## Risks & gotchas

- Step 3 tightens an acceptance criterion for unbuilt backend work — strictly a testability improvement, but it constrains the schema (`Match` must not auto-touch an updatedAt on pass); note this for the backend/data agents in the PR description.
- ENV-15's requirement row itself (`FS-05:43`) already says "bit-identical" without the modulo clause — keep row and acceptance criterion aligned after the edit.
- The 6-month default remains ⚠️ ASSUMPTION either way; this fix only removes the phantom "configurable" claim, it does not resolve the assumption.
