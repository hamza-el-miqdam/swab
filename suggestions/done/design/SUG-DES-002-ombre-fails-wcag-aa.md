# SUG-DES-002 — `ombre` text token fails WCAG AA contrast on every Nuit surface

- **Area:** design
- **Topic:** accessibility
- **Impact:** high
- **Effort:** M
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a (charter-level; affects all screens using `flab` labels/meta)

## Problem / Opportunity

The design charter itself demands "4.5:1 contrast minimum for text (WCAG 2.2 AA); verify `brume`/`ombre` on `nuit`/`encre` before promoting a new pairing" (`agents/design-specialist.md:71-72`). Measured (WCAG relative-luminance formula) with the SSOT values (`packages/ui/tokens/tokens.json:10-18`):

| Foreground | on `nuit` #0F1426 | on `encre` #171E38 | on `voile` #202949 | on `voile-2` #28325A |
|---|---|---|---|---|
| `ombre` #6A7194 | **3.83** | **3.44** | **2.99** | **2.60** |
| `brume` #9AA1C2 | 7.18 | 6.45 | 5.59 | 4.87 |

`ombre` is a text token — "Tertiary text — labels, meta, muted values" (`tokens.json:18`) — and is specified for the field label `flab` at **11 px uppercase** (`docs/design-system.md:76`) and meta/caption text (`docs/design-system.md:78`). 11-12 px text is unambiguously "normal size" under WCAG (large-text 3:1 relief starts at 18 pt / 14 pt bold), so every current `ombre` pairing fails AA; on `voile` inputs/rows it is below even the 3:1 large-text bar.

## Implementation plan

1. Open an `area:design` issue (charter change — rule 5, `agents/design-specialist.md:90-91`: palette changes need an issue).
2. Recommended value change: lighten `ombre` to `#8A91B5` — measured 5.92 on `nuit`, 5.31 on `encre`, 4.61 on `voile`, 4.01 on `voile-2` (only `voile-2` still below 4.5; see step 4). A more conservative `#8289AD` gives 5.34 / 4.79 but fails on `voile` (4.16) — prefer `#8A91B5`.
3. Propagate through the mandatory chain in one PR (`tokens.json` meta.rule, `packages/ui/tokens/tokens.json:6`): update `docs/design/swab-prototype-consolidated.html` `:root` (`--ombre`, line 15 area), `docs/design-system.md` §1 Text table (line 37), then `packages/ui/tokens/tokens.json:18`, then `node packages/ui/scripts/generate.mjs` to regenerate `tokens.ts`, `tokens.css`, `DesignTokens.swift`, `DesignTokens.kt`. Update the Penpot "Nuit" token set to match when the MCP plugin is connected.
4. Add a usage rule to `docs/design-system.md` §1: "`ombre` may not be used for text on `voile-2`; minimum text token on `voile-2` is `brume` (4.87:1)."
5. Root `CHANGELOG.md` entry; the regenerated native files ride the same PR per the codegen exception (`agents/design-specialist.md:24-36`).

## Tests & acceptance criteria

- Contrast script (node one-liner or the future generator validation of SUG-DES-005) confirms new `ombre` ≥ 4.5:1 on `nuit`, `encre`, `voile`.
- `node packages/ui/scripts/generate.mjs --check` passes (no drift).
- Visual spot-check of the consolidated prototype: `flab` labels and meta text remain visibly "tertiary" (dimmer than `brume` #9AA1C2 — the new value is still darker than brume, preserving hierarchy).

## Risks & gotchas

- This changes rendered UI on both native apps through the generated files — notify `area:ios`/`area:android` in the PR, but no consuming-code change is needed (they reference `DesignTokens.Color`, e.g. `apps/android/.../ui/theme/Theme.kt:43` uses brume, iOS `CarteTheme.textDim`).
- Do not "fix" this by making `ombre` text larger instead — sizes are also charter values.
- Keep the French token name; change the value only.
