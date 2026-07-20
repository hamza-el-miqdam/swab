# SUG-SPEC-011 — OQ-ENV-2 (expiry semantics) is presented as decided in the spec-kit artifact but still open in FS-05

- **Area:** specs
- **Topic:** consistency
- **Impact:** low
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** ENV-07, OQ-ENV-2

## Problem / Opportunity

- FS-05 keeps the question open: "OQ-ENV-2: default expiry 24h vs same-day-midnight semantics." (`docs/specs/FS-05-envie-match.md:60`), with ENV-07 carrying "default 24h ⚠️ ASSUMPTION" (`FS-05:26`).
- The spec-kit artifact states a decision: "Default envie expiry is 24 hours from creation (FS-05 OQ-ENV-2); **same-day-midnight semantics were considered and rejected** in favor of a fixed rolling window, pending final confirmation." (`specs/001-envie-match/spec.md:114`).

"Considered and rejected" records a resolution that never happened in the authoritative document — FS-05 is authoritative on conflict by the artifact's own header (`spec.md:11`), and playbook §7 says "agents never resolve OQs implicitly" (`docs/agent-playbook.md:64`). A `/speckit-plan` run would treat midnight semantics as settled-out while the Architect still owns the open question. The checklist note (`specs/001-envie-match/checklists/requirements.md:36`) correctly describes the item as "pending final product-owner sign-off", contradicting spec.md's "rejected" phrasing within the same artifact.

## Implementation plan

1. Edit `specs/001-envie-match/spec.md:114`, replacing the assumption bullet with: "Default envie expiry is a 24-hour rolling window from creation — FS-05's documented buildable default (ENV-07 ⚠️ ASSUMPTION). OQ-ENV-2 (24h vs same-day-midnight) **remains open with the product owner**; build behind an expiry-policy seam so switching semantics is not a rewrite (playbook §4 rule 6)."
2. No FS-05 change — its state (assumption + open OQ) is the correct one.
3. Root `CHANGELOG.md` entry (`area:specs`).

## Tests & acceptance criteria

- `grep -n "rejected" specs/001-envie-match/spec.md` → zero hits.
- spec.md's assumption now agrees with both `FS-05:60` and `checklists/requirements.md:36` (all three say: default 24h, question open).

## Risks & gotchas

- If Hamza has in fact decided (check the OQ question issue / Notion comments via the liaison before editing), the correct fix inverts: resolve OQ-ENV-2 in FS-05 and strip the ⚠️ from ENV-07 instead. Verify first; default to the wording above if no decision is recorded.
- No Notion impact (spec-kit artifacts are not mirrored).
