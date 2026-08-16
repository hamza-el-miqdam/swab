# SUG-AND-009 — Ivory initials on pastel état backgrounds fail contrast (~2:1) on the map nodes

- **Area:** android
- **Topic:** accessibility
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** MAP-03, MAP-08

## Problem / Opportunity

`ContactNode` (/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/ui/carte/RadialMap.kt:221-246) paints:

- background = the état pastel from `EtatColors.ETAT_COLORS` (EtatColors.kt:18-22): `#8FB59A` (disponible), `#C8917E` (occupé), `#8AA0BE` (ailleurs) — mid-light colors;
- text = `MaterialTheme.colorScheme.onSurface` (RadialMap.kt:246), which under the single Nuit theme is IVOIRE `#edebe2` (Theme.kt:41, DesignTokens.kt:19).

Ivory (#EDEBE2, relative luminance ≈ 0.83) on #8FB59A (≈ 0.42) gives roughly a 1.9:1 contrast ratio; the other two pastels are similar. WCAG AA requires 4.5:1 for text this size (13sp, RadialMap.kt:246). So the initials — the only glanceable node content, per Labels.kt:27 — are near-invisible exactly when a contact has an état set. Nodes without an état use `surface` (ENCRE `#171e38`) background with ivory text and are fine (RadialMap.kt:222).

The theme already contains the correct precedent for "dark text on a light accent": `ETOILE_ENCRE` `#1c1505` used as `onPrimary` over the light étoile gold (Theme.kt:47-48).

## Implementation plan

1. Extend `EtatColors.EtatColor` (EtatColors.kt:25) with a foreground: `data class EtatColor(val background: String?, val border: String?, val onBackground: String?)`.
2. In `etatColor()` (EtatColors.kt:27-30), return a dark ink for the three known états. Reuse the existing dark token rather than inventing a value: `DesignTokens.Color.ETOILE_ENCRE` (`#1c1505`) is charter-sourced and yields ≥ 7:1 on all three pastels. If pulling `ui.theme.DesignTokens` into the `carte` package is undesirable (it currently only imports `l10n.Fr` — keep the package platform-free either way, DesignTokens is also import-free per its header DesignTokens.kt:4-7), hardcode the same hex with a comment pointing at the token, mirroring how EtatColors already carries blueprint hexes.
3. In `ContactNode` (RadialMap.kt:246), use it:
   ```kotlin
   val textColor = palette.onBackground?.let(::hexToColor) ?: MaterialTheme.colorScheme.onSurface
   Text(Labels.initials(contact.displayName), fontSize = 13.sp, color = textColor)
   ```
4. Check the other two consumers of the palette — the legend dot (CarteScreen.kt:140-149) and list/peek dots (RingList.kt:76-84, PeekSheet.kt:49-57) render 10dp color swatches with the label as separate normal-contrast text, so they need no change. Confirm and note in the PR.
5. Do NOT change the three background hexes themselves — they are the flagged blueprint divergence that must not be silently altered (EtatColors.kt:6-10, rn-native-handoff.md:151-153).
6. CHANGELOG entry (G5).

## Tests & acceptance criteria

- JVM, extend `EtatColorsTest` (apps/android/app/src/test/kotlin/com/swab/android/carte/EtatColorsTest.kt):
  - `MAP-03 each known etat provides a dark onBackground color`: assert non-null and equal to the chosen ink for all three états.
  - `MAP-03 unknown or null etat has null onBackground (falls back to theme)`.
  - Optional but recommended: a real guard `MAP-03 onBackground meets 4.5:1 contrast on its background` — implement WCAG relative-luminance math (pure Kotlin, ~15 lines) in the test and assert ratio ≥ 4.5 for each pair. This locks the invariant against future palette edits.
- Run: `cd apps/android && ./gradlew test`; visual spot-check on the emulator via `scripts/e2e-android.sh` run (existing map tests must stay green — they match nodes by contentDescription, not color).

## Risks & gotchas

- Product/design ownership: node colors are design-agent territory (packages/ui tokens SSOT, per the 2026-07-19 token work) — the PR should flag the added `onBackground` mapping for the design agent to ratify rather than treating it as final.
- Keep `EtatColors` free of Android/Compose imports (its stated contract, EtatColors.kt:11-15) — hex strings only.
- The fallback branch (no état) must keep using the theme color so unset-état nodes keep adapting if the theme ever changes.
