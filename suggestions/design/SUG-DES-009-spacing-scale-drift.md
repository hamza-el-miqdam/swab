# SUG-DES-009 — Spacing scale drifts between the token contract and the SSOT (14/20 missing, 32 undocumented)

- **Area:** design
- **Topic:** tokens
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

The human-readable contract and the machine SSOT disagree on the spacing scale — the exact "code and design never disagree" failure G5 forbids:

- `docs/design-system.md:82`: "**Spacing scale** (px): `4 · 8 · 12 · 14 · 16 · 20 · 24`. Screen content padding `14 20 20`."
- `packages/ui/tokens/tokens.json:36-43`: `xs:4, s:8, sm:12, m:16, l:24, xl:32` — no `14`, no `20`, and a `32` that appears nowhere in the contract or the consolidated prototype's documented scale.

`14` and `20` are not fringe values: screen content padding is `14 20 20` (`design-system.md:82`), button horizontal padding is 14 (`tokens.json:55` uses it as a component value), tag padding is `8 14`, tiles pad `15px 14px` (`docs/design/swab-prototype-consolidated.html:102`). A native dev pulling `DesignTokens.Spacing` today cannot express the charter's screen padding without magic numbers. Meanwhile `xl: 32` looks invented relative to the documented chain (the SSOT's own rule forbids inventing values there, `tokens.json:6`). `docs/STATUS.md` (Design system row) already flags "39 micro-spacing values" as a known gap — this suggestion is the narrower, immediately-fixable contradiction inside the *published* scale.

## Implementation plan

1. Open the reconciliation as an `area:design` decision with the user, then land ONE canonical scale in both places in the same PR. Recommended (extraction-faithful): add the two missing steps and either justify or drop `32`:

   ```json
   "spacing": { "xs": 4, "s": 8, "sm": 12, "m": 14, "ml": 16, "l": 20, "xl": 24 }
   ```

   ⚠️ Renaming existing keys (`m`,`l`,`xl`) changes generated identifiers (`DesignTokens.Spacing.m` etc.). If any consumer exists by then, prefer the non-breaking additive form: keep current keys, add `"m14": 14, "l20": 20` — uglier but safe. As of this audit no app code consumes `DesignTokens.Spacing` (verified by grep — see SUG-DES-004), so the clean rename is currently free.
2. If `32` is genuinely used in the prototype (verify with `grep -c "32px" docs/design/swab-prototype-consolidated.html` before deciding), add it to `design-system.md:82` instead of deleting it; whichever way, both files must list the identical set.
3. Add a `screenPadding` component token capturing `14 20 20`: `"screen": { "paddingTop": 14, "paddingHorizontal": 20, "paddingBottom": 20 }` under `component` in `tokens.json`.
4. Regenerate (`node packages/ui/scripts/generate.mjs`), update `docs/design-system.md` §3, root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- The set of numbers in `design-system.md:82` equals the set of values in `tokens.json` `spacing` (manual review check, or asserted by the SUG-DES-005 validator if extended).
- `generate.mjs --check` green; `docs/STATUS.md` design-row note about the spacing gap updated if this closes part of it.

## Risks & gotchas

- Key naming is API: once SUG-DES-004 wires spacing into native themes, renames become cross-platform breaking changes — do this reconciliation FIRST (ordering dependency with SUG-DES-004).
- Do not silently bless `32` — either evidence it from the prototype or remove it; the SSOT's own meta.rule (`tokens.json:6`) makes unsourced values a defect.
