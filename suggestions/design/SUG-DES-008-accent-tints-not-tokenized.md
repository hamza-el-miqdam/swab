# SUG-DES-008 — Étoile accent tints (.05 glow / .14 chip fill / .30 switch track) are documented but not tokens

- **Area:** design
- **Topic:** tokens
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

`docs/design-system.md:46` names two derived accent tints as part of the contract: "Accent tints (derived, used for chip/selected fills): `rgba(228,190,106,.14)` fill, `rgba(228,190,106,.30)` switch-on track." The consolidated prototype uses three:

- `rgba(228,190,106,.05)` — the nuit background's radial gold glow (`docs/design/swab-prototype-consolidated.html:20`; also promised by `docs/design-system.md:24` "Carries a faint radial gold glow, top-left" — the `.05` value is documented nowhere).
- `rgba(228,190,106,.14)` — chip fill (`swab-prototype-consolidated.html:59`).
- `rgba(228,190,106,.3)` — switch-on track (`swab-prototype-consolidated.html:151`).

None are in `packages/ui/tokens/tokens.json` (its `color` section, lines 9-24, has no opacity-bearing étoile variant), so native chips/switches/glows must hand-derive alphas — and the SSOT already has the exact mechanism for this: `hair`/`hair-fort` are stored as base hex + `opacity` (`tokens.json:14-15`) and every generator handles that shape (`generate.mjs:88-92`, `:143-149`, `:210-216`, `:303-309`).

## Implementation plan

1. Add three tokens to `tokens.json` `color`, reusing the `hair` pattern:

   ```json
   "etoile-voile":  { "value": "#e4be6a", "opacity": 0.14, "role": "Accent tint fill — chips, selected fills." },
   "etoile-piste":  { "value": "#e4be6a", "opacity": 0.30, "role": "Accent tint — switch-on track." },
   "etoile-lueur":  { "value": "#e4be6a", "opacity": 0.05, "role": "Radial gold glow over nuit (background only)." }
   ```

   (French names consistent with the charter's naming-by-role rule, `agents/design-specialist.md:60-61`; adjust wording with the user if better French exists — the values are fixed.)
2. `node packages/ui/scripts/generate.mjs` — no generator change needed; opacity-bearing colors already render in all four formats.
3. Update `docs/design-system.md:46` to name the tokens (and add the `.05` glow value to §1's `nuit` row, line 24, closing that undocumented gap).
4. Root `CHANGELOG.md` entry; Penpot token set updated when connected.

## Tests & acceptance criteria

- `generate.mjs --check` green; `tokens.css` contains `--color-etoile-voile: rgba(228, 190, 106, 0.14);` (and hex fallback var), Swift/Kotlin gain `etoileVoile`/`ETOILE_VOILE` + opacity constants.
- design-system.md no longer states tint values that exist nowhere in the SSOT.

## Risks & gotchas

- Keep them in `color` (not `component`) — the switch track alpha is also referenced by future Compose/SwiftUI switches; component geometry stays in `component`.
- The glow is decoration on `nuit` only — note in the role text that status hues remain "never decorative" (`docs/design-system.md:48`); this tint is the sanctioned exception already present in the charter.
