# SUG-DES-007 — Motion values exist in the charter and prototype but have no tokens

- **Area:** design
- **Topic:** tokens
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

`docs/design-system.md` §4 defines motion normatively: "Screen transitions: 0.28s fade + 4px rise. Respect `prefers-reduced-motion` (disable all)" (`docs/design-system.md:118-121`), and §3 adds "primary button `:active` scales to `.985`; border-color transitions `.15s`" (`docs/design-system.md:87`). The consolidated prototype implements them: `animation:fade .28s ease` (`docs/design/swab-prototype-consolidated.html:53`), `transform:scale(.985)` (`:66`), `transition:border-color .15s` (7 occurrences), `translateY(4px)` rise, and the reduced-motion kill-switch (`:172`). Yet `packages/ui/tokens/tokens.json` has no `motion` section at all (top-level keys are `meta,color,typography,spacing,radius,component`, `tokens.json:2-77`) — so when iOS/Android/web implement transitions they must re-read prose and hand-copy numbers, exactly the drift the SSOT exists to prevent (FS-01/02/03 screens already shipped with whatever durations their authors picked).

## Implementation plan

1. Add to `tokens.json` (extraction from the prototype, not invention):

   ```json
   "motion": {
     "screenTransition": { "durationMs": 280, "riseDistance": 4, "easing": "ease" },
     "borderTransition": { "durationMs": 150 },
     "controlTransition": { "durationMs": 200 },
     "pressScale": 0.985,
     "reducedMotion": "disable-all"
   }
   ```

   (`controlTransition` 200ms from `transition:transform .2s,background .2s` in the prototype's switch styles.)
2. Extend `generate.mjs` with a `motion` renderer for all four targets, following the existing `component` group pattern (`generate.mjs:116-131` TS, `:173-188` CSS, `:260-281` Swift, `:344-366` Kotlin): numbers as ms/scalar constants, strings as string constants. CSS: `--motion-screen-transition-duration: 280ms;` etc.
3. Update `docs/design-system.md` §4 to point at the token names, and add `motion` to the SUG-DES-005 validation allowlist if that landed first.
4. Regenerate + root `CHANGELOG.md` entry. Native adoption (SwiftUI `.animation`, Compose `tween(280)`) goes via `area:ios`/`area:android` proposals, not design edits.

## Tests & acceptance criteria

- `node packages/ui/scripts/generate.mjs --check` green after regen; the four generated files contain the motion constants.
- Values byte-match the prototype: 280ms/4px/ease, 150ms, 200ms, 0.985.
- design-system.md §4 and tokens.json agree (spot-check in review).

## Risks & gotchas

- "Respect prefers-reduced-motion / disable all" is a behavior contract, not a number — keep it a documented string token so consumers can't claim ignorance, but enforcement lives in each platform (Compose: `LocalAccessibilityManager`/animation scale; iOS: `UIAccessibility.isReduceMotionEnabled`).
- Product ethos guard: motion tokens are for calm fades only — the charter forbids celebration animation ("No progress bars, no 'match!' moment, no confetti", `docs/design-system.md:121`); do not add tokens like `celebration*`.
