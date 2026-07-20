# SUG-DES-011 — Interactive components (tag, segmented cell, switch) sit below 44 pt/48 dp touch minimums, and no minimum-target token exists

- **Area:** design
- **Topic:** accessibility
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md) for tokens/contract; ios-specialist / android-specialist adopt hit-area rules in app code
- **Related requirement IDs:** n/a (affects FS-01 calibration/tags, FS-03 axes, FS-04 subgroup chips when built)

## Problem / Opportunity

Apple HIG requires ≥ 44×44 pt and Material ≥ 48×48 dp touch targets (WCAG 2.5.8 AA floor is 24 px). Several charter components are visually smaller, and neither the contract nor the SSOT states any minimum-target rule:

- **Tag/chip**: `paddingVertical: 8`, `paddingHorizontal: 14` (`packages/ui/tokens/tokens.json:57-61`); prototype `.tag{padding:8px 14px;...font-size:13px}` (`docs/design/swab-prototype-consolidated.html:89`) → ≈ 8+17+8 ≈ **33 px** tall. Tags are selectable controls ("unselected, selected", `docs/design-system.md:103`).
- **Segmented / intimacy cells**: `cellPaddingVertical: 10, cellPaddingHorizontal: 2` (`tokens.json:62-65`); prototype `.lvl,.segb{...padding:10px 2px;...font-size:12.5px}` (`swab-prototype-consolidated.html:92`) → ≈ **36 px** tall.
- **Switch**: "38 × 21 track" (`docs/design-system.md:110`) — **21 px** interactive height.
- `docs/design-system.md:86` ("Hit targets") lists paddings only; no minimum. Button height 48 (`tokens.json:53`) is the only compliant explicit height.

Visual size ≠ hit size — the calm aesthetic can stay if hit areas are extended invisibly, but nothing in the contract tells implementers to do that.

## Implementation plan

1. design-specialist adds to `tokens.json` `component`: `"touch": { "minTarget": 44 }` (pt/dp; single number — Android consumers read it as dp and round up to 48 where Material requires, see step 3 wording).
2. Add a normative paragraph to `docs/design-system.md` §3 after the "Hit targets" bullet (`design-system.md:86`): "**Minimum touch target:** every interactive element responds to touches in a ≥ 44×44 pt (iOS) / 48×48 dp (Android) region, extended invisibly beyond the visual bounds when the drawn control is smaller (tag ≈33 px, segmented cell ≈36 px, switch 21 px). Visual geometry above is unchanged."
3. Regenerate; open `area:ios` / `area:android` proposals: iOS — `.contentShape(Rectangle())` + `.frame(minHeight: 44)` or `hitTest` padding on Tag/Segmented/Switch wrappers; Android — `Modifier.minimumInteractiveComponentSize()` (Material3 built-in, defaults 48 dp) on the equivalent composables.
4. Root `CHANGELOG.md` entry; Penpot component descriptions annotated when connected.

## Tests & acceptance criteria

- `generate.mjs --check` green; `DesignTokens.Component.Touch.minTarget` (Swift) / `Component.Touch.MIN_TARGET` (Kotlin) exist.
- Native adoption PRs: Compose UI test asserting tag row's touch bounds ≥ 48 dp (`assertTouchHeightIsAtLeast`), iOS XCUITest tapping 2 pt outside a tag's visual edge still toggles it.
- Visual regression: rendered sizes unchanged (the fix is hit-area-only).

## Risks & gotchas

- Do not enlarge the visual components to "fix" this — the charter geometry is normative; only hit areas grow.
- Adjacent 33 px rows with 44 pt hit areas can overlap hit regions in dense lists; where rows stack tighter than 44 pt, WCAG 2.5.8's spacing exception applies — flag such screens in the proposal rather than silently overlapping.
- RTL-safety unaffected (hit padding is symmetric).
