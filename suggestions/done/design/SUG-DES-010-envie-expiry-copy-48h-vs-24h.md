# SUG-DES-010 — Prototype copy says envies expire in 48 h; FS-05 assumes 24 h

- **Area:** design
- **Topic:** consistency
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md) + spec-specialist for the FS-05 side (requirement text is area:specs)
- **Related requirement IDs:** ENV-07

## Problem / Opportunity

The consolidated prototype's "Envie scellée" confirmation reads: "Café · ce soir 19h · mes amis-voisins. **Elle expire dans 48 heures.**" (`docs/design/swab-prototype-consolidated.html:524`). The spec says: "ENV-07 | Envies expire (default **24h** ⚠️ ASSUMPTION). Expiry is invisible to recipients (they never knew)." (`docs/specs/FS-05-envie-match.md:25`).

French UI copy is normative and flows blueprint → spec-frozen → code verbatim (`agents/design-specialist.md:86-89`; CLAUDE.md "French UI copy comes from specs verbatim"). FS-05 is ⚪ Not started (`docs/STATUS.md` modules table), so right now two normative sources hand the implementing agents contradictory numbers — and ENV-07 is explicitly a flagged assumption, meaning the blueprint's 48 h may in fact be the intended product value that the spec author didn't have.

## Implementation plan

1. Do NOT guess the product answer (G4: "If a spec is ambiguous, comment on the issue and stop"). Open an issue titled `[ENV-07] Envie TTL: 48h (prototype) vs 24h (spec assumption)` tagging the user for the product decision.
2. Once decided:
   - If 48 h wins: spec-specialist amends `docs/specs/FS-05-envie-match.md:25` to "default 48h" and removes the ⚠️ ASSUMPTION flag (and freezes the sentence « Elle expire dans 48 heures. » in FS-05's copy inventory so code copies it verbatim).
   - If 24 h wins: design-specialist edits `docs/design/swab-prototype-consolidated.html:524` to « Elle expire dans 24 heures. » (and its byte-identical twin `blueprints/swab-app-prototype.html` — see SUG-DES-013 — plus the Penpot prototype screen when connected).
3. Whichever direction, note the resolution in root `CHANGELOG.md` (design) or the spec changelog convention (specs), and the notion-liaison mirrors the FS-05 change.

## Tests & acceptance criteria

- `grep -o "expire dans [0-9]*" docs/design/swab-prototype-consolidated.html blueprints/swab-app-prototype.html` and `grep -n "ENV-07" docs/specs/FS-05-envie-match.md` show the same number of hours.
- ENV-07 no longer carries the ⚠️ ASSUMPTION marker (either confirmed or corrected).

## Risks & gotchas

- Product-ethos check passed on the copy itself: a static "expire dans 48 heures" sentence on the sender's own confirmation is calm information, not a countdown/urgency widget, and expiry stays invisible to recipients (ENV-07) — implementers must NOT turn it into a live counter (forbidden by product law 5 / `agents/design-specialist.md:76-79`).
- Resolve before FS-05 implementation starts (currently ⚪) — after that it becomes a code change too.
