# SUG-AND-014 — ONB-04 requires radial calibration prefiguring the map; the shipped screen is a text list, while the radial canvas already exists

- **Area:** android
- **Topic:** correctness
- **Impact:** medium
- **Effort:** L
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-04, ONB-05, ONB-06

## Problem / Opportunity

FS-01 ONB-04 (docs/specs/FS-01-onboarding.md:23): "Calibration is radial: « moi » center; dragging/tapping a contact assigns it to an intimacy ring. The layout must visually prefigure the FS-02 map." FS-01's header says Implemented (line 3).

The shipped `CalibrateScreen` (/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/ui/onboarding/CalibrateScreen.kt:27-80) is a vertical list of `GhostButton` rows — no « moi », no rings, nothing radial. Its header comment (CalibrateScreen.kt:20-25) justified this as "the true radial canvas ships with FS-02 (Wave 2)" — but FS-02 shipped on 2026-07-10 (CHANGELOG.md:27-32) with a full radial implementation (`RadialMap`, `MapGeometry`, ring rendering, node placement), and calibration was never upgraded. The deferral condition has been met for a while; ONB-04's "visually prefigure the map" is now spec drift on a screen every new user sees.

The building blocks are all reusable: `MapGeometry.ringRadius`/`positionOn`/`nodeSize` (MapGeometry.kt:26-47), the rings/spokes Canvas and density handling (RadialMap.kt:144-166), `Labels` a11y vocabulary (Labels.kt:12-33), and the list interaction can stay as the accessibility fallback FS-01 explicitly wants ("VoiceOver/TalkBack path exists for ring placement (list-based fallback)", docs/specs/FS-01-onboarding.md:38).

## Implementation plan

1. Extract the ring-canvas backdrop into a shared composable so carte and calibrate render one spatial truth: move `RingsAndSpokes` (RadialMap.kt:144-166) plus `MeNode` (RadialMap.kt:169-180) from `ui/carte/RadialMap.kt` into a new `ui/carte/RingCanvas.kt` (same package to avoid visibility churn; both files keep compiling).
2. New `ui/onboarding/CalibrateRadial.kt`: renders the 320dp canvas (`MapGeometry.MAP_SIZE.dp` — follow the dp-vs-px rules documented at RadialMap.kt:67-73 exactly), placed contacts as nodes via `MapGeometry.positionOn`, and unplaced contacts in a horizontal tray below (mirror of CarteScreen.kt:95-106).
3. Interaction = tap-to-select + tap-ring-to-place (matching the v0 interaction the RN reference used and the current ViewModel API — no drag needed to satisfy "dragging/tapping"):
   - Tap a tray chip or node → `viewModel.select(id)` (CalibrateViewModel.kt:35-37).
   - While selected, render the four ring bands as tappable targets: overlay four transparent ring-hit areas (annulus hit-testing: compute `distance(tapOffset, center) / density`, map to the nearest `MapGeometry.ringRadius(ring)`), then `viewModel.placeSelectedOnRing(ring)` (CalibrateViewModel.kt:39-45). Keep the existing per-ring buttons beneath the canvas as the always-available accessible path (they carry `${Fr.CALIBRATE_RING_PREFIX} $ring — $label` labels the E2E suite drives, E2EFlows.kt:188).
   - Keep `Fr.CALIBRATE_LIST_MODE` toggle: list mode renders exactly today's screen (it is the TalkBack fallback; the string already exists, Fr.kt:50).
4. No ViewModel changes required — `CalibrateViewModel` already exposes contacts/selectedId/place/setEtat/setRessenti; this is UI-only, preserving ONB-05 (vault-only writes; the VM imports no network code).
5. Sequence AFTER SUG-AND-002 (the ring-button overflow fix) to avoid rebasing the same lines.
6. CHANGELOG entry (G5); if any aspect is descoped (e.g. drag), state it and keep the spec honest — do not edit the spec yourself (spec-specialist owns docs/specs, G4).

## Tests & acceptance criteria

- JVM: annulus hit-testing must live in `MapGeometry` (e.g. `fun ringForDistance(r: Float): Int?` with a half-band tolerance) → table-driven `MapGeometryTest` cases: `ONB-04 ringForDistance maps radii to rings 1-4 and rejects center/outside`. Run `cd apps/android && ./gradlew test`.
- E2E (`scripts/e2e-android.sh`): the existing copy-driven calibration flow (E2EFlows.kt:180-191) must keep passing unchanged (it drives the accessible ring buttons, which remain). Add `test_ONB04_radialCanvas_showsMoiAndRingsOnCalibrate`: assert `Fr.CALIBRATE_ME` contentDescription exists on the calibrate screen (mirror of `test_MAP01_09_mapRendersMoiAndPlacedContactNodes`, RelationshipMapE2ETest.kt:40).
- Manual on-device check for the ONB-04 acceptance "layout visually prefigures the FS-02 map" — screenshot pair in the PR.

## Risks & gotchas

- Density traps: every historical Android map bug here was dp-vs-px (RadialMap.kt:67-73, 95-99; CHANGELOG.md:30). Reuse the existing patterns verbatim; the density regression E2E test guards carte but not calibrate — consider duplicating it for the calibrate canvas.
- `moi` label: calibrate uses `Fr.CALIBRATE_ME`, carte uses `Fr.CARTE_ME` (both "moi", Fr.kt:49/79) — parameterize `MeNode(label: String)` rather than hardcoding.
- ONB-06 must stay intact: the état/ressenti layer stays collapsed-by-default below the canvas (CalibrateScreen.kt:57-76 logic unchanged).
- 60fps requirement (FS-01 non-functional, line 38): the canvas is static during calibration (no pan/zoom needed) — keep it that way; don't add transform gestures to onboarding.
