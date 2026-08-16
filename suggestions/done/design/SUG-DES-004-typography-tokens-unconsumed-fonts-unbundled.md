# SUG-DES-004 — Typography/spacing/radius tokens are generated but consumed by no app; charter fonts are not bundled

- **Area:** design
- **Topic:** consistency
- **Impact:** high
- **Effort:** L
- **Implementing agent:** ios-specialist + android-specialist (theme wiring is app code — `agents/design-specialist.md:35-36` explicitly leaves "theme wiring, SwiftUI/Compose call sites" to `area:ios`/`area:android`); design-specialist only files the two proposals
- **Related requirement IDs:** n/a (visual fidelity of all implemented FS-01/02/03 screens)

## Problem / Opportunity

The SSOT generates full `Typography`, `Spacing`, `Radius`, and `Component` blocks for both platforms, but only `Color` is consumed anywhere:

- A repo-wide grep of `apps/ios/Sources` and `apps/android/app/src/main` for `DesignTokens.` finds exclusively `DesignTokens.Color.*` references (`apps/ios/Sources/SwabCore/Carte/CarteTheme.swift:11-23`, `apps/android/.../ui/theme/Theme.kt:38-48`). Zero references to `DesignTokens.Typography`, `.Spacing`, `.Radius`, or `.Component` in either app.
- `SwabTheme` passes only a color scheme: `MaterialTheme(colorScheme = SwabNuit, content = content)` (`Theme.kt:52-54`) — so Android renders Material3's default Roboto type ramp, not Inter/Space Grotesk (`docs/design-system.md:56-65`), and default M3 shapes, not the charter radii (`tokens.json:44-50`).
- No font files exist in either app: `find apps/ios apps/android -iname "*.ttf" -o -iname "*.otf"` returns nothing outside build artifacts, despite the contract "Two families, self-hosted … bundled on mobile" (`docs/design-system.md:58`; `agents/design-specialist.md:64-65` "no external font requests reach production").

## Implementation plan

1. design-specialist opens two proposals (one `area:ios`, one `area:android`) with the mapping tables below; no app-code edits from design.
2. **Android** (android-specialist):
   a. Add Inter (400/500/600) and Space Grotesk (400/500/600) as `res/font/` resources (OFL-licensed; note license files in the PR — "no new deps without justification", G4).
   b. Build `androidx.compose.material3.Typography` from `DesignTokens.Typography` (`apps/android/.../ui/theme/DesignTokens.kt`, generated): e.g. `titleLarge` ← `TITLE` (Space Grotesk 20/500, lineHeight = size×1.25), `bodyLarge` ← `BASE` (Inter 15/400, lineHeight 24sp), `labelLarge` ← `BUTTON`, `bodyMedium` ← `SUBTITLE`, `labelSmall` ← `LABEL` (11sp, letterSpacing 1.1sp, uppercase applied at call sites — Compose has no textTransform).
   c. Build `Shapes` from `DesignTokens.Radius` (`small` = INPUT 10, `medium` = CARD 12, `large` = TILE 14) and pass both into `MaterialTheme` in `Theme.kt:52-54`.
3. **iOS** (ios-specialist):
   a. Bundle the same two families in the app target; register via `UIAppFonts`.
   b. Add a `SwabUI` helper mapping `DesignTokens.Typography` styles to `Font.custom(_:size:relativeTo:)` with `relativeTo:` anchors (Dynamic Type — see SUG-DES-012) and apply in the existing screens' text styles.
4. Both apps log the change in their area changelog (G5); E2E gate per G2 before Done.

## Tests & acceptance criteria

- Grep acceptance: at least one reference each to `DesignTokens.Typography` and `DesignTokens.Radius`/`Shapes` in each app's theme layer.
- Android: unit test asserting `SwabTypography.bodyLarge.fontSize == DesignTokens.Typography.BASE.size.sp` (plain-JVM testable since DesignTokens is framework-free).
- iOS: `xcrun swift test` green; screenshot check that titles render Space Grotesk (glyph difference from SF is visible on "S").
- No network font fetches (charter rule).

## Risks & gotchas

- Do not hand-edit the generated `DesignTokens.*` files (banner rule, `generate.mjs:25-26`); mapping lives in `Theme.kt` / new SwabUI files.
- `lineHeight` tokens are unitless multipliers (`tokens.json:26-34`) — convert to sp/pt (size × multiplier) at the mapping layer; document the conversion in the proposal so both platforms do it identically.
- M3 roles left deliberately unset in `Theme.kt:30-36` (error/tertiary/secondary) stay unset — this proposal covers typography/shapes only.
