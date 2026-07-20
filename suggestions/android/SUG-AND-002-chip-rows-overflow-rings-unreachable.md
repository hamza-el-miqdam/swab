# SUG-AND-002 — Fix the known CalibrateScreen layout bug: rings 3/4 unreachable; same overflow pattern on FicheScreen chip rows

- **Area:** android
- **Topic:** correctness
- **Impact:** high
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-04, ONB-05, FCH-01

## Problem / Opportunity

The E2E suite itself documents an open production bug: `E2EFlows.kt` refuses to calibrate onto rings 3/4 — /Users/mikedown/Workspace/Swab/apps/android/app/src/androidTest/kotlin/com/swab/android/e2e/E2EFlows.kt:184-186:

```kotlin
require(ring == 1 || ring == 2) {
    "Rings 3/4 have a known CalibrateScreen layout bug (out of scope) — use ring 1 or 2 in tests."
}
```

and apps/android/CHANGELOG.md:18 calls it "the open `CalibrateScreen` text-wrap bug". Root cause: CalibrateScreen.kt:47-53 renders all four ring buttons in a plain `Row` with no scroll/wrap:

```kotlin
Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    for ((ring, label) in RING_LABELS) {
        GhostButton("${Fr.CALIBRATE_RING_PREFIX} $ring — $label") { ... }
    }
}
```

Four buttons with long French labels («Anneau 3 — Familier», «Anneau 4 — Plus loin») overflow the screen width, so users cannot place a contact on rings 3 or 4 during onboarding — a core ONB-04 interaction is broken on-device.

The same unscrollable-`Row` pattern exists on the fiche and will overflow on narrow screens/large font scale:

- FicheScreen.kt:118-122 (4 intimité chips), :130-134 (5 role chips — «Famille/Amitié/Travail/Voisinage/Autre»), :142-145 (état), :157-160 (ressenti).
- CalibrateScreen.kt:64-67 and :70-73 (état/ressenti rows — 3 items each, currently borderline).

## Implementation plan

1. In `apps/android/app/src/main/kotlin/com/swab/android/ui/onboarding/CalibrateScreen.kt`, replace the ring-selection `Row` (lines 47-53) with a `Column` of full-width buttons (simplest, most a11y-friendly, no new API):
   ```kotlin
   Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
       for ((ring, label) in RING_LABELS) {
           GhostButton("${Fr.CALIBRATE_RING_PREFIX} $ring — $label") {
               viewModel.placeSelectedOnRing(ring)
           }
       }
   }
   ```
   (Alternative: `FlowRow` from `androidx.compose.foundation.layout` — it is in the existing compose-bom, so no new dependency; either is acceptable, a Column is the least surprising.)
2. In `apps/android/app/src/main/kotlin/com/swab/android/ui/fiche/FicheScreen.kt`, wrap each chip `Row` in `Modifier.horizontalScroll(rememberScrollState())` (pattern already used in CarteScreen.kt:96-98) or switch to `FlowRow`. Touch `IntimiteAxis` (line 118), `RolesAxis` (line 130), `EtatAxis` (line 142), `RessentiAxis` (line 157).
3. Apply the same treatment to CalibrateScreen's état/ressenti rows (lines 64-73).
4. Update the E2E driver: remove the `require(ring == 1 || ring == 2)` guard in E2EFlows.kt:184-186, extend `ringLabel` map (line 182) to all four rings (`mapOf(1 to Fr.RING_1, 2 to Fr.RING_2, 3 to Fr.RING_3, 4 to Fr.RING_4)`).
5. Update apps/android/CHANGELOG.md with the fix entry (G5) and note the bug is closed.

## Tests & acceptance criteria

- Extend `OnboardingE2ETest.test_ONB01_08_happyPath_welcomeToCarte` (OnboardingE2ETest.kt:30) — or add `test_ONB04_allFourRingsPlaceable` — to calibrate one contact on ring 3 and one on ring 4, asserting `waitUntilTextExists("$name — ${Fr.RING_3}")` / `Fr.RING_4`.
- Existing `RelationshipMapE2ETest.test_MAP08_listModeGroupsContactsByIntimacyLevel` should then also be extendable to a ring-3 group (optional).
- Run: `scripts/e2e-android.sh` (all tests must pass, report PASS with zero drift); JVM: `cd apps/android && ./gradlew test` (no domain change, must stay green).

## Risks & gotchas

- Do not change any French copy — labels come from `Fr` verbatim (CLAUDE.md hard boundary).
- The Column variant changes visual layout of the calibrate screen; keep the button labels identical so the copy-based E2E selectors (`onNodeWithText("${Fr.CALIBRATE_RING_PREFIX} $ring — $label")`) keep working.
- `FlowRow` was stabilized in newer compose versions; with BOM 2024.09.00 it may still require `@OptIn(ExperimentalLayoutApi::class)` — the Column/horizontalScroll options avoid that entirely.
