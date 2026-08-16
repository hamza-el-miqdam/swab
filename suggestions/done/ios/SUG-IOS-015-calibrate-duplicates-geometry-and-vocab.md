# SUG-IOS-015 — CalibrateView privately duplicates MapGeometry, CarteLabels, and the état/ressenti vocabulary

- **Area:** ios
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** ONB-04, ONB-06

## Problem / Opportunity

`CalibrateView` predates the Wave-2 `SwabCore/Carte` modules and still carries private copies of things that now have a single source of truth:

- `CalibrateGeometry` (`apps/ios/Sources/SwabUI/Onboarding/CalibrateView.swift:16-32`) re-implements `ringRadius` with the same `(mapSize / 2) * (ring / 4.6) + 24` formula as `MapGeometry.ringRadius` (`Sources/SwabCore/Carte/MapGeometry.swift:23-25`) and a private golden-angle `position` beside `MapGeometry.positionOn` (`MapGeometry.swift:40-47`). The file's own header says the inlining was deliberate *until* Wave 2 landed ("It is deliberately NOT the full `MapGeometry` port — that is Wave 2 scope", `CalibrateView.swift:5-9`) — Wave 2 has long landed; the debt is now just drift risk.
- `Self.etats` / `Self.ressentis` (`CalibrateView.swift:38-39`) duplicate `FicheVocabulary.etats/ressentis` (`Sources/SwabCore/Fiche/FicheVocabulary.swift:15-16`), whose doc comment explicitly exists so "the fiche and the map/calibrate screens never disagree" — the calibrate screen just doesn't consume it.
- `Self.ringLabels` (`CalibrateView.swift:40`) duplicates `CarteLabels.ringLabel` (`Sources/SwabCore/Carte/CarteLabels.swift:7-12`).
- Placement drift: calibrate positions placed contacts by their **global** index (`viewModel.contacts.enumerated()`, `CalibrateView.swift:116-118`), while the carte uses a **per-ring** index (`RadialMapView.placedNodes`, `Sources/SwabUI/Carte/RadialMapView.swift:22-32`) — so the same contact sits at a different angle during onboarding than on the map it is supposed to "visually prefigure" (ONB-04).

## Implementation plan

1. Delete `CalibrateGeometry`; use `MapGeometry.ringRadius` / `MapGeometry.positionOn` (they are `Double`-based — convert with `CGFloat(...)` at the view boundary; `positionOn` returns a top/left chip origin, so add `MapGeometry.nodeHalfWidth/nodeHalfHeight` to get the center, same as `ContactNodeView.center` does, `RadialMapView.swift:132-139`).
2. Compute per-ring indexes for placement, copying the `placedNodes` reduction from `RadialMapView.swift:22-32` (or extract that little loop into `MapGeometry` as `static func perRingIndexes(_ rings: [Int?]) -> [Int]` and use it in both views — preferred, it's pure math and belongs there with a table-driven test).
3. Replace `Self.etats`/`Self.ressentis` with `FicheVocabulary.etats`/`FicheVocabulary.ressentis`, and `Self.ringLabels` with `CarteLabels.ringLabel` (values are identical `Fr.t` lookups today, so zero visual change).
4. Keep the accessibility label formats in `CalibrateView` exactly as-is (`"\(Fr.t(.calibrateRingPrefix)) \(ring) — ..."`, `:149`) — `OnboardingFlow` builds lookups from that exact string (`SwabAppUITests/Support/OnboardingFlow.swift:104-106`).

## Tests & acceptance criteria

- If `perRingIndexes` is extracted: `Tests/SwabCoreTests/MapGeometryTests.swift` addition `test_MAP01_perRingIndexes_countsPerRingNotGlobally` — input rings `[1, 2, 1, nil, 1]` → indexes `[0, 0, 1, ignored, 2]`.
- No new behavior otherwise — the acceptance gate is the full existing suite: `cd apps/ios && xcrun swift test` (110+) and `scripts/e2e-ios.sh` (calibration flow `test_ONB01to08_happyPath_reachesCarteWithCalibratedContacts` exercises the changed placement path directly).
- Visual spot check for the PR: screenshot the calibrate screen with 3 placed contacts before/after; positions may legitimately shift (per-ring indexing) — that is the ONB-04 fidelity improvement, note it in the changelog entry.

## Risks & gotchas

- Position changes are user-visible during onboarding; they align calibrate with the carte, which is what ONB-04 asks ("visually prefigure the FS-02 map") — call it out rather than hiding it.
- `MapGeometry.mapSize` is 320, same as the old `CalibrateGeometry.mapSize` — no frame changes, but double-check the `nodeHalfWidth` offset (28) matches the calibrate chip size before reusing `positionOn` centers.
