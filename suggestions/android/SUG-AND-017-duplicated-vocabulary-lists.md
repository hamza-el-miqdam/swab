# SUG-AND-017 — État/ressenti/ring vocab lists are copy-pasted across three files with a "don't let them diverge" comment instead of a shared constant

- **Area:** android
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-04, ONB-06, FCH-01, FCH-06

## Problem / Opportunity

The classification vocabularies are defined multiple times in the UI layer:

- `ETATS = listOf(Fr.ETAT_AVAILABLE, Fr.ETAT_BUSY, Fr.ETAT_AWAY)` and `RESSENTIS = listOf(Fr.RESSENTI_LIGHT, Fr.RESSENTI_PRECIOUS, Fr.RESSENTI_PAUSED)` exist verbatim in BOTH /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/ui/onboarding/CalibrateScreen.kt:17-18 AND /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/ui/fiche/FicheScreen.kt:50-51. FicheScreen.kt:45-49 even documents the hazard: "redefined here (not imported) because those lists aren't exported from that file … Do not add values here without touching CalibrateScreen too, or the two screens will silently diverge."
- `RING_LABELS = mapOf(1 to Fr.RING_1, …)` in CalibrateScreen.kt:16 duplicates `Labels.RING_LABEL` (carte/Labels.kt:13-18), which FicheScreen correctly imports (FicheScreen.kt:119).
- `EtatColors.ETAT_COLORS` (carte/EtatColors.kt:18-22) keys off the same three état strings a third time.

A divergence here is not just a style bug: FCH-06's filter-consequence lookup (`FicheFilterConsequence.forValue`, FicheFilterConsequence.kt:22-25) and the vault contents are keyed by these exact strings — a typo'd or partially-updated list would silently split the vocabulary between screens and inside users' encrypted data, which is very hard to migrate later.

## Implementation plan

1. Create `apps/android/app/src/main/kotlin/com/swab/android/carte/Vocab.kt` (the `carte` package already hosts the shared, platform-free vocabulary objects `Labels`/`EtatColors` — no new package needed; alternatively `l10n`, but `Labels` precedent says `carte`):
   ```kotlin
   /** Shipped classification vocabularies (single source — ONB-04/06, FCH-01/06).
    *  The 3-état set vs the blueprint's 5 is the flagged divergence
    *  (EtatColors.kt header / rn-native-handoff.md §5) — do not extend here
    *  without a product decision. */
   object Vocab {
       val ETATS: List<String> = listOf(Fr.ETAT_AVAILABLE, Fr.ETAT_BUSY, Fr.ETAT_AWAY)
       val RESSENTIS: List<String> = listOf(Fr.RESSENTI_LIGHT, Fr.RESSENTI_PRECIOUS, Fr.RESSENTI_PAUSED)
   }
   ```
2. Replace the private lists: CalibrateScreen.kt:17-18 and FicheScreen.kt:50-51 → `Vocab.ETATS` / `Vocab.RESSENTIS`; delete the now-obsolete divergence-warning comment block (FicheScreen.kt:45-49).
3. Replace `RING_LABELS` in CalibrateScreen.kt:16 with `Labels.RING_LABEL` (identical content; the screen already builds `"${contact.displayName} — $ringLabel"` strings the E2E suite matches — output is unchanged).
4. Key `EtatColors.ETAT_COLORS` iteration order off `Vocab.ETATS` if desired (optional; the map already uses the same `Fr` constants so it cannot typo-diverge — leave as is to keep the diff minimal).
5. CHANGELOG entry (G5).

## Tests & acceptance criteria

- New JVM test `apps/android/app/src/test/kotlin/com/swab/android/carte/VocabTest.kt`:
  - `FCH-06 every etat with a color mapping is in the shared ETATS list` (assert `EtatColors.ETAT_COLORS.keys == Vocab.ETATS.toSet()`).
  - `ONB-06 vocab lists contain exactly the shipped three values each` (locks the flagged 3-value divergence until a product decision).
- Existing suites are the real guard: `LabelsTest`, `EtatColorsTest`, `FicheFilterConsequenceTest`, and the copy-driven E2E flows (E2EFlows drives calibrate/fiche by these exact strings) — all must pass unchanged. Run `cd apps/android && ./gradlew test` then `scripts/e2e-android.sh`.

## Risks & gotchas

- Rendering must stay byte-identical (French copy is normative; E2E selectors are copy-based). This is a pure de-duplication — any visible text change means a mistake.
- Do NOT add `en pause` to ETATS while touching this — FCH-06's blueprint divergence is a known, deliberately-unresolved product decision (FicheFilterConsequence.kt:10-20); this refactor must not smuggle in a resolution.
- Keep `Vocab` free of Android/Compose imports (JVM-testability convention of the `carte` package, EtatColors.kt:11-15).
