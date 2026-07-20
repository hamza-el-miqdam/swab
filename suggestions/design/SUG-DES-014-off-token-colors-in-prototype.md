# SUG-DES-014 — Consolidated prototype uses two colors that exist in no token: `#4A5170` (illustration node) and `#05070F` (device shell)

- **Area:** design
- **Topic:** tokens
- **Impact:** low
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** MAP-* (the `#4A5170` node appears in a carte illustration)

## Problem / Opportunity

A full hex inventory of the normative prototype (`docs/design/swab-prototype-consolidated.html`) against `packages/ui/tokens/tokens.json:9-24` leaves exactly two unmatched colors:

- `#4A5170` — an SVG carte-illustration node fill: `<circle cx="252" cy="170" r="4" fill="#4A5170"/>` (`swab-prototype-consolidated.html:409`), next to a sibling node using token `#6A7194` (`ombre`). Per the persona rule "A colour that exists in the app but not in the token file … is a defect" (`agents/design-specialist.md:10-11`), and this one plausibly represents a real map state (a dimmer/inactive node) that native carte rendering will need — today it's an untracked magic value.
- `#05070F` — the device *shell* and Dynamic Island fill: `.device{...background:#05070F...}` (`:38`), island (`:40`). This is presentation chrome ("Device chrome … Presentation frame only", `docs/design-system.md:117`), so it likely should be explicitly declared presentation-only rather than tokenized.

## Implementation plan

1. `#4A5170`: decide its meaning with the user (dimmed node? decorative depth cue?). Then either
   - (a) promote it: add to `tokens.json` `color` (e.g. `"ombre-nuit": { "value": "#4a5170", "role": "Dimmed carte node — decorative depth in map illustration." }`), document in `docs/design-system.md` §1, regenerate; or
   - (b) demote it: edit the prototype SVG to reuse `var(--ombre)`/an existing token, keeping the illustration's depth by opacity instead (e.g. `fill="#6A7194" fill-opacity=".65"`).
2. `#05070F`: no new token; add one sentence to `docs/design-system.md` §3's device-frame bullet (`design-system.md:85`): "Shell/Dynamic-Island fill `#05070F` is presentation chrome only and is intentionally outside the token set." That converts an undocumented exception into a documented one, so future audits don't re-flag it.
3. Remember the byte-identical twin file (see SUG-DES-013) if the prototype is edited. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- After the fix, a hex inventory of the prototype (`grep -o "#[0-9a-fA-F]\{6\}"` lowercased, uniq) contains only: token values from `tokens.json`, plus `#05070f` documented as chrome (or zero unmatched if 1(b) chosen and chrome documented).
- `generate.mjs --check` green if 1(a) added a token.

## Risks & gotchas

- If 1(a), the French name must follow name-by-role (`agents/design-specialist.md:60-61`) — confirm wording with the user; do not ship an English name.
- Trivial by itself, but it keeps the "every rendered color is a token" invariant machine-checkable — worth doing before the carte screens get more illustration work.
