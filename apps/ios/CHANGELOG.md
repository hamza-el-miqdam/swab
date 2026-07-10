# apps/ios — Changelog

## 2026-07-10 — [FCH-01..08] Wave 3: FS-03 Contact Card (Fiche contact), natively (greenfield)

**What:** FS-03 was never built in the RN reference (`apps/mobile`) — no port, built from `docs/specs/FS-03-contact-card.md` alone, wired into the existing FS-02 seam (`PeekSheetView`'s « Ouvrir la fiche »).

`SwabCore/Fiche/` (pure, no SwiftUI import — unit-testable):

- `FicheHistoryEvent.swift` — `Codable`/`Hashable` local-only history entry: `.axisChanged(axis:value:)`, `.reconfirmed`, `.relationshipEvent(String)` (the last case exists for a future FS-05 match event to populate; nothing writes it yet).
- `FicheAxis.swift` — the four axis identifiers (`intimite`/`roles`/`etat`/`ressenti`), shared between history events and UI copy lookups.
- `FicheVocabulary.swift` — OQ-FCH-1 placeholder taxonomy. Rôles·contexte (Famille/Amitié/Travail/Voisinage/Autre) is an ⚠️ ASSUMPTION invented for this walking skeleton, not blueprint-sourced. État/Ressenti deliberately reuse the exact 3-value sets already shipped in Wave 1 (`CalibrateView`'s `etats`/`ressentis`, `EtatColors.byLabel`) rather than inventing a new list, per the task brief.
- `FicheStaleness.swift` — `shouldShowNudge(lastAxisChangeAt:snoozedUntil:now:stalenessInterval:)`, pure/testable. Default staleness interval is six months (⚠️ ASSUMPTION, spec flags this explicitly as unresolved); snooze window is 30 days (spec's own acceptance criterion).
- `FicheFilterConsequence.swift` — FCH-06 informational-only text. **Divergence flag** (documented, same pattern as `EtatColors.swift`'s own flag): the spec calls `en pause` an ÉTAT value, but the vocabulary actually shipped in Wave 1 put "en pause" under RESSENTI (`Fr.ressentiPaused`) — `EtatColors`/`CalibrateView`'s état set has no pause value. Per the brief's instruction to reuse the existing 3-value état set rather than invent a new one, this checks BOTH `etat` and `ressenti` for "en pause" so the consequence text stays legible regardless of which axis holds it; a product decision should resolve which axis it belongs to, not this code.
- `FicheEligibility.swift` — FCH-08: `isEnvieActive(targetId:)` — pending contacts (`targetId == nil`) get inactive envie eligibility, nothing else.

`SwabCore/Vault/Vault.swift` (extended, not replaced):

- `VaultContact` gains `targetId: String?` (FCH-08 — mirrors FS-07's `ContactLink.targetId`; no separate `ContactLink` type exists in this client yet), `history: [FicheHistoryEvent]` (FCH-04), `lastAxisChangeAt`/`stalenessSnoozedUntil: Date?` (FCH-05). Now conforms to `Hashable` (needed for SwiftUI's `.navigationDestination(item:)`, see gotcha below) with a **custom** `Codable` (`init(from:)`/`encode(to:)`, not synthesized) so a Wave 1/2 blob that predates `history` (a non-optional array — synthesized decoding would throw on a missing key) decodes to `[]` instead of failing.
- New `Vault` actor methods: `getContact(id:)` (fresh-copy single-contact fetch), `setFicheRing/Etat/Ressenti/Roles(id:...)` — distinct from the existing `setRing`/`setEtat`/`setRessenti` (still used unchanged by Wave 1's `CalibrateView`) because every fiche edit ALSO appends a history event and resets the FCH-05 staleness timer, `reconfirmFicheStaleness(id:)` (« C'est toujours ça »: resets timer, logs a quiet `.reconfirmed` entry, doesn't touch axis values), `snoozeFicheStaleness(id:)` (« À revoir plus tard »: 30-day window, deliberately does NOT append a history event — nothing to log, matching the spec's "nothing is logged server-side" acceptance criterion literally even though this is local-only either way).

`SwabUI/Fiche/` (SwiftUI, MVVM, mirrors `CarteViewModel`'s shape):

- `FicheViewModel.swift` — `@Observable`, wraps one `VaultContact` + the owning `Vault`; every setter is optimistic (mutate vault, then `refresh()` from the fresh copy — no pending/queued state needed since the vault itself is already the local source of truth and `VaultSync` reconciles separately). Exposes `recentHistory` (12-month filter + newest-first sort), `shouldShowStalenessNudge`, `filterConsequenceText`, `isEnvieActive`.
- `FicheView.swift` — four tap-editable axis sections (ring chips, a `FlowRolesView` multi-select grid for rôles, état/ressenti chips), the FCH-05 staleness banner (never a modal — a plain inline `VStack`, exactly two actions), FCH-06 filter-consequence text, FCH-08 pending notice, an explicit FCH-02 asymmetry hint, an FCH-03 "Aucun compteur, aucune métrique" footer (no numeric reciprocity signal is shown at all — the safest reading of "if shown" was not to show one), and the FCH-04 history feed.

Wiring into FS-02:

- `PeekSheetView.swift` — « Ouvrir la fiche » is no longer `.disabled(true)`; it now takes an `onOpenFiche: (VaultContact) -> Void` closure. Per the task's explicit instruction, nothing else in this file's existing peek-sheet content was touched.
- `CarteViewModel.swift` — added `makeFicheViewModel(for:)` so `CarteView` can construct a `FicheViewModel` without `CarteView` holding its own `Vault` reference (keeps `Vault` a private implementation detail of `CarteViewModel`, and doesn't add a networking-adjacent symbol to the file `CarteOfflineInvariantTests` scans).
- `CarteView.swift` — closes the peek sheet and pushes `FicheView` via `.navigationDestination(item:)` (not another `.sheet`) onto the same `NavigationStack` `RootView` already provides. This satisfies FCH-07 "by construction": `CarteView` stays mounted underneath the pushed fiche (a `.sheet` dismiss doesn't destroy the presenting view; neither does a stack push), so `RadialMapView`'s pinch/pan `@State` survives a round trip to the fiche and back — no bespoke position-save/restore code was needed.

**Why:** Wave 3 of the RN → native migration — FS-03 is the first FS in this migration with no RN reference to port from (`apps/mobile` never built it), so this is genuinely new native design work, built directly from `docs/specs/FS-03-contact-card.md`.

**Test results:** `cd apps/ios && xcrun swift test` — **110/110 tests pass, 0 failures** (77 from Waves 1–2 + 33 new: `FicheStalenessTests` (9), `FicheVaultTests` (13), `FicheFilterConsequenceTests` (4), `FicheEligibilityTests` (2), `FicheVocabularyTests` (3), `FichePrivacyInvariantTests` (2)). Coverage (`swift test --enable-code-coverage` + `llvm-cov report` over `Sources/SwabCore/**`): **93.94% line coverage overall** (up from 92.73%); every new `Fiche/` module is at **100%** line coverage; `Vault.swift` (now carrying the FS-03 fiche methods alongside the original ones) is at **97.91%**. `xcodebuild -project SwabApp.xcodeproj -scheme SwabApp -destination 'platform=iOS Simulator,name=iPhone 17' -configuration Debug CODE_SIGNING_ALLOWED=NO build` → **BUILD SUCCEEDED**, confirming the app target (not just the SPM test target) picks up the `PeekSheetView` signature change and the new `Fiche` sources cleanly.

**FCH-01..08 status:**

| Requirement | Status | Notes |
|---|---|---|
| FCH-01 (four tap-editable axes, immediate vault write + local history) | ✅ | `FicheVaultTests` (`setFicheRing/Etat/Ressenti/Roles`); `FicheView`'s axis chips call these directly, no debounce/queue |
| FCH-02 (asymmetric/private, no symmetry implied) | ✅ | Nothing on the fiche reads or displays any "how they classified you" data — no such data exists anywhere in this client's vault shape, so there's nothing to accidentally surface; explicit `fiche.asymmetryHint` copy states this outright |
| FCH-03 (reciprocity signal qualitative only, no counters/metrics) | ✅ | No numeric reciprocity signal is rendered at all (chose not to show one over risking a numeric-feeling qualitative one); `fiche.noMetrics` = "Aucun compteur, aucune métrique." renders unconditionally; `CopyEthosTests` (existing, generic over all `Fr.swift` keys) covers the new copy's no-digit/no-gamification-word constraints for free |
| FCH-04 (history feed, 12mo, newest first, vault-only) | ✅ | `FicheVaultTests.test_FCH04_historyFeed_newestFirst`; `FicheViewModel.recentHistory`'s 12-month `Calendar` cutoff is not itself unit-tested in isolation (would need date-injectable `now`, which `recentHistory` doesn't take — see deferred) but the underlying `Vault` history ordering it relies on is |
| FCH-05 (staleness nudge, default 6mo ⚠️ ASSUMPTION, exactly two actions, 30-day snooze) | ✅ | `FicheStalenessTests` (9 boundary/timing cases) + `FicheVaultTests` (reconfirm/snooze vault-level behavior); `FicheView.stalenessNudge` renders as a plain inline banner, never a `.sheet`/`.alert` |
| FCH-06 (`en pause` état → filter consequence text) | 🟡 | Consequence text implemented and tested (`FicheFilterConsequenceTests`), but see the DIVERGENCE FLAG in `FicheFilterConsequence.swift`: the shipped vocabulary has "en pause" under ressenti, not état, so this checks both axes rather than cleanly satisfying the spec's literal "État values include `en pause`" — flagged, not silently resolved |
| FCH-07 (back navigation preserves map position) | 🟡 | Achieved by construction (push, not sheet-replace, onto the existing `NavigationStack` — `CarteView`/`RadialMapView` never get torn down) and confirmed by code review + the `xcodebuild` app-target build succeeding with the real navigation wiring; **not** verified by an on-device tap-through (no UI test target, no scripted-Simulator-tap permission in this sandbox — same limitation Wave 2's MAP-04 entry already documents) |
| FCH-08 (pending contact, `targetId == nil`, fully editable, inactive envie) | ✅ | `FicheVaultTests.test_FCH08_pendingContact_axesAreFullyEditable`, `FicheEligibilityTests`; `FicheView.pendingNotice` renders `fiche.pendingHint`/`fiche.envie.inactive` when `!isEnvieActive` |

**Privacy invariant (G1, FS-03's own acceptance criterion):** `FichePrivacyInvariantTests.test_FCH01_axisEditsOverNetwork_onlyOpaqueBlobAndVersionEverSent` drives a *real* `ApiClient.pushVault` call (through `VaultSync.sync()`, the exact path production code takes) against a fake `HTTPTransport` that captures the literal `URLRequest.httpBody` bytes after every FCH-01 axis has been edited with distinctive plaintext strings (all étal/ressenti/rôles values + a distinctive display name) — asserts the captured JSON body's keys are exactly `{blob, version}` and that none of the plaintext classification strings appear anywhere in the serialized body. A second test (`test_FCH01_encryptedVaultBlob_neverContainsClassificationPlaintext`) restates the same invariant at the ciphertext-at-rest boundary. This is stronger than the existing `ApiClientPrivacyInvariantTests` (which only structurally checks the `Encodable` type's field list) because it exercises the actual serialized wire payload after real fiche writes.

**Gotchas discovered:**

15. **`VaultContact` needed `Hashable`, not just `Equatable`**, for SwiftUI's `.navigationDestination(item: Binding<D?>)` (`D: Hashable`). Declaring it in `SwabCore` (its home module) is a plain, non-retroactive conformance — no `@retroactive` question like Wave 2's `Identifiable` sheet-vs-navigationDestination tradeoff (see Wave 2 gotcha #13); this is why `.navigationDestination(item:)` was usable here where `.sheet(item:)` wasn't there.
16. **Adding a non-optional stored property (`history: [FicheHistoryEvent]`) to an existing `Codable` struct silently breaks decoding of already-persisted data unless you write a custom `init(from:)`.** Swift's synthesized `Decodable` only auto-defaults *Optional*-typed properties to `nil` on a missing key (via an implicit `decodeIfPresent`); a non-optional `Array` property with no key present throws. Caught by writing `test_backwardCompat_legacyContactWithoutFicheFields_decodesWithDefaults` (feeds a hand-written legacy-shaped JSON string with no FS-03 keys at all) before touching the real `Vault` methods — this test would have failed loudly with the naive synthesized-`Codable` approach.
17. **Providing a custom `init(from:)` disables synthesis of `encode(to:)` too** (Swift requires both-or-neither once you touch one) — had to write the `encode(to:)` mirror by hand alongside it.

**Deferred (honestly, not silently):**

- **FCH-07's on-device "return to map, position preserved" behavior is not exercised by an automated UI test.** Same category of gap as Wave 2's MAP-04 animated-move claim: SwiftUI navigation/position-state assertions need a UI test target this package doesn't have. Verified by code review (the mechanism — staying on the same `NavigationStack`, no view teardown — is structural, not incidental) and a successful real app-target build, not a live tap-through.
- **No UI/interaction tests for `FicheView`/`FicheViewModel`** — consistent with every other `SwabUI` view in this codebase (Wave 1 onboarding, Wave 2 carte): all new logic that *can* be unit-tested without SwiftUI lives in `SwabCore` and is tested there (100% on every new `Fiche/` file); `FicheViewModel`'s own thin glue (`recentHistory`'s date-cutoff wiring, `refresh()`'s vault round-trip) is exercised only via code review + the successful app build.
- **FCH-06's état/ressenti taxonomy divergence (`en pause`) is not resolved, only flagged** — a product decision is needed on which axis "en pause" actually belongs to; tracked alongside OQ-FCH-1 in `docs/specs/FS-03-contact-card.md`.
- **OQ-FCH-1 remains genuinely open** — `FicheVocabulary.roles` is this task's own placeholder invention, not extracted from the blueprint with Hamza as the spec calls for.
- **FCH-04's "relationship events (matches with this person)" case exists in the type (`FicheHistoryEvent.Kind.relationshipEvent`) but nothing populates it** — FS-05 (envie/match) isn't built yet; the shape is forward-compatible so a future match event can append without another vault-shape migration, exactly like `history`'s own backward-compat handling above.

**apps/ios structure (additions only):**
```
apps/ios/
  Sources/SwabCore/Fiche/{FicheHistoryEvent,FicheAxis,FicheVocabulary,FicheStaleness,FicheFilterConsequence,FicheEligibility}.swift
  Sources/SwabUI/Fiche/{FicheViewModel,FicheView}.swift
  Tests/SwabCoreTests/{FicheStalenessTests,FicheVaultTests,FicheFilterConsequenceTests,FicheEligibilityTests,FicheVocabularyTests,FichePrivacyInvariantTests}.swift
```

## 2026-07-10 — [MAP-01..09] Wave 2: FS-02 Relationship Map, natively

**What:** 1:1 port of the RN reference (`apps/mobile/src/map/*`, `app/(main)/carte.tsx`,
`app/(main)/_layout.tsx`, `src/ui/nav-bar.tsx`) into `apps/ios`, plus the 3-tab nav shell
(MAP-02) wired in after onboarding's `.complete` step.

`SwabCore/Carte/` (pure, no SwiftUI import — unit-testable, no UI dependency):

- `MapGeometry.swift` — `mapSize = 320`, `rings = [1,2,3,4]`, `ringRadius(ring) = (mapSize/2) * (ring/4.6) + 24`, `positionOn(ring:index:)` using the golden angle `2.399963` rad/index, `clamp`, `panBound(scale:)`, `nodeSize(ring:)`. Byte-for-byte port of `apps/mobile/src/map/geometry.ts`'s formulas — verified against the same math computed independently in Python (see `MapGeometryTests`), not derived circularly from the Swift code itself.
- `EtatColors.swift` — état → hex color (`disponible` #8FB59A, `occupé` #C8917E, `ailleurs` #8AA0BE), unset/unrecognized → neutral `CarteTheme.surface`/`line`. Divergence flag carried forward verbatim from `apps/mobile/src/map/etatColors.ts`'s comment: the blueprint's 5-état taxonomy is mapped onto the SHIPPED 3-état vocabulary — not silently expanded.
- `CarteLabels.swift` — `ringLabel` dict, `contactLabel` (« Léa — Très proche » format, MAP-08), `initials` (up to 2, uppercased, ASCII/Unicode whitespace-aware).
- `CarteTheme.swift` — the 8 theme hex colors from `apps/mobile/src/theme.ts`, kept as plain strings (not `Color`) so `SwabCore` stays free of any UI-framework import; `SwabUI/Carte/ColorHex.swift` does the `Color(hex:)` conversion at the view layer.

`SwabUI/Carte/` (SwiftUI, MVVM):

- `CarteViewModel.swift` — `@Observable`, holds `contacts`/`listMode`/`legendOpen`/`selected`, `refresh()` reads the vault only. Deliberately imports nothing beyond `Observation`/`SwabCore` — no networking symbol appears in this file (MAP-05), asserted structurally by `CarteOfflineInvariantTests` (reads the file's own source text off disk via `#filePath` and fails if `URLSession`/`ApiClient`/`HTTPTransport`/`VaultSync` ever appears).
- `RadialMapView.swift` — ring circles + 4 hairline spokes (0/45/90/135°) + « moi » center pill, one `ContactNodeView` per placed contact, pinch (`MagnificationGesture`, 1x–3x) + pan (`DragGesture`) combined via `.simultaneously`, both bounded through `MapGeometry.clamp`/`panBound`. `ContactNodeView` tracks `hasAppeared` per instance: first mount sets its position directly (no travel), a later `.onChange(of:)` on the computed point wraps the update in `withAnimation(.easeInOut(duration: 0.35))` — the SwiftUI equivalent of the RN reference's `mounted` ref pattern (MAP-04: re-tag → animated move, no teleport).
- `PeekSheetView.swift` — native `.sheet(isPresented:)` (not `.sheet(item:)`, to sidestep a `VaultContact: Identifiable` retroactive-conformance question across module boundaries) showing Intimité/État/Rôles rows; « Ouvrir la fiche » rendered visibly `.disabled(true)` — the FS-03 seam, same as the RN reference.
- `RingListView.swift` — `List`/`Section` grouped by ring (MAP-08), unplaced contacts get a trailing unheaded section, every row's `accessibilityLabel` is `CarteLabels.contactLabel`.
- `CarteView.swift` — composes the above: list/map mode toggle, calm empty state (MAP-06, `carte.empty`), unplaced-contacts tray (nothing hidden, MAP-09), état legend toggle. Refreshes on `.task` (first appear) and on `scenePhase` transitioning to `.active` (foreground) so an FS-03 re-tag is picked up on return without a relaunch.
- `MainTabsView.swift` — exactly 3 tabs (Carte/Envie/Sous-groupes) via `TabView`/`.tabItem { Text(...) }` — labels only, no badge/counter modifier exists anywhere in this file, so none can appear (MAP-02, MAP-09/ethos law 5). `EnvieView`/`SousGroupesView` are calm placeholder screens (FS-05/FS-04 seams).

`App/SwabApp.swift` — the `.complete` case of `RootView`'s switch now renders `MainTabsView(vault: vault)` instead of the old static "done" placeholder text. Everything else in the app shell (Keychain-backed `SecureStore`, file-backed `KeyValueStore`, real `ApiClient`) is unchanged — a 6-line diff.

**Why:** Wave 2 of the RN → native migration (`docs/migration/rn-audit-map.md`) — the carte is the app's home screen and the first screen a user with a calibrated vault actually lands on.

**Test results:** `cd apps/ios && xcrun swift test` — **77/77 tests pass, 0 failures** (55 from Wave 1 + 22 new: `MapGeometryTests` (9), `EtatColorsTests` (6), `CarteLabelsTests` (5), `CarteOfflineInvariantTests` (2)). Coverage on `SwabCore` (`swift test --enable-code-coverage` + `llvm-cov report`): **92.73% line coverage** overall; the three new Carte modules (`MapGeometry.swift`, `EtatColors.swift`, `CarteLabels.swift`) are each at **100%** line coverage. `SwabUI`'s new Carte views/view model are not separately coverage-measured (same pattern as Wave 1's onboarding views — no ViewInspector-style tooling in this package) but `CarteViewModel`'s only non-trivial logic (`refresh`/`select`/`unplaced`/`placed`) is thin enough that the MAP-05 structural test plus the visual Simulator verification below stand in for it.

**MAP-01..09 status:**

| Requirement | Status | Notes |
|---|---|---|
| MAP-01 (radial layout, moi centered, ring from vault) | ✅ | `MapGeometryTests`; visually confirmed on Simulator (screenshot below) |
| MAP-02 (exactly 3 nav items, no badges) | ✅ | `MainTabsView` — no badge/counter API call exists in the file, by construction |
| MAP-03 (état/ring visual encoding) | ✅ | `EtatColorsTests`, `MapGeometryTests.test_MAP03_nodeSizeStepsDownPerRing` |
| MAP-04 (tap → peek sheet, animated re-tag, disabled fiche seam) | 🟡 | Peek sheet + disabled button implemented and code-reviewed against the RN reference; the animated-vs-snap mount behavior is implemented (`ContactNodeView`'s `hasAppeared` tracking) but **not** covered by an automated UI test — SwiftUI position-animation assertions need a UI test target this package doesn't have (same gap as Wave 1's onboarding views) |
| MAP-05 (offline-first, no network) | ✅ | `CarteOfflineInvariantTests` — structural source scan of `CarteViewModel.swift` |
| MAP-06 (calm empty state) | ✅ | `carte.empty` copy (already ported in Wave 1's `Fr.swift`), rendered when `contacts.isEmpty` |
| MAP-07 (≤150 contacts, 60fps pan/zoom, no jank) | 🟡 | Geometry math verified exactly (`MapGeometryTests`); 60fps-under-load was **not** profiled with Instruments in this pass (no realistic 150-contact fixture walked live) — SwiftUI `Button`-per-node may need to move to `Canvas` if profiling later shows jank, per the ios-specialist rule; not attempted here |
| MAP-08 (screen-reader list fallback) | ✅ | `RingListView` + `CarteLabelsTests`; every row carries `accessibilityLabel` via the same `contactLabel` helper the map uses |
| MAP-09 (no counters/search/sorting) | ✅ | Existing generic `CopyEthosTests` cover every `Fr.swift` key including the carte.*/nav.* strings added in Wave 1; no search/sort UI exists in any new file |

**Simulator verification (honest account):** `xcodebuild -project SwabApp.xcodeproj -scheme SwabApp -destination 'platform=iOS Simulator,name=iPhone 17' -configuration Debug CODE_SIGNING_ALLOWED=NO build` → **BUILD SUCCEEDED**, confirming the new Carte sources compile as part of the real app target (not just the SPM test target). Installed + launched fresh (`xcrun simctl install/launch`) — reproduced the same "cold start shows Welcome, no crash" result as Wave 1's app-shell entry.

To actually see the Carte UI render (reaching it live requires OTP against a running `docker compose` API, unavailable in this sandbox — same limitation `rn-audit-map.md` already documents for iOS), the app's entry point was **temporarily** swapped for a throwaway view that seeds an in-memory vault with 2 placed contacts (ring 1 « disponible », ring 3 « occupé ») + 1 unplaced contact and jumps straight to `MainTabsView`, then reverted immediately after screenshotting (`git diff apps/ios/App/SwabApp.swift` shows only the intended 6-line `.complete` wiring — the temporary view never landed). The screenshot confirmed, pixel-measured against the known scale factor: ring circles + spokes render at the exact `MapGeometry` radii (the "Sam" node measured at ~128pt from center, matching `ringRadius(3) = 128.35` to within rounding), état colors render correctly (green for disponible, terracotta for occupé), the unplaced tray shows "Unplaced Person" as a chip, the légende toggle and list-mode switch are present, and the 3-tab nav bar reads exactly "Carte / Envie / Sous-groupes" with no badges. Tapping a node to open the peek sheet was **not** exercised live — this sandbox has no assistive-access permission for scripted Simulator taps (`osascript`/System Events return `-1719`, the same blocker Wave 1 hit), so `PeekSheetView`'s presentation is verified by code review + the disabled-button assertion pattern only, not an on-device tap.

**Gotchas discovered:**

11. **A doc comment that names the exact symbols a structural "no networking import" test scans for will itself trip that test.** `CarteViewModel.swift`'s first draft explained the MAP-05 invariant by literally writing `URLSession`/`ApiClient` in a comment — `CarteOfflineInvariantTests` (which scans the raw source text, not compiled symbols) failed on its own doc comment. Fixed by rephrasing the comment to describe the invariant without naming the banned tokens. Worth remembering for any future structural/tripwire test: it can't distinguish code from prose.
12. **`xcrun simctl` commands need `dangerouslyDisableSandbox` in this environment**, or they hang indefinitely (a `simctl list devices` call sat for 2+ minutes with zero output before being killed) — a bare sandboxed `Bash` call to `simctl` appears to stall on some IPC/XPC call to `CoreSimulatorService` that needs broader process permissions. Once re-run with the sandbox disabled, the same commands returned in under a second. Not previously documented in the Wave 1 entry (that pass apparently avoided hitting it, or ran outside this particular sandboxing config).
13. **`.sheet(item:)` would need `VaultContact: Identifiable`, which — declared in `SwabUI` over a `SwabCore` type conforming to a stdlib protocol — is a retroactive conformance requiring `@retroactive` under Swift 6 conventions; `Package.swift` still pins `swift-tools-version: 5.10`, where that attribute's availability was unverified without risking a build break.** Sidestepped entirely by using `.sheet(isPresented:)` with a computed `Binding` instead — no retroactive conformance needed, same UX.
14. **SwiftUI's `.onChange(of:)` needs `Equatable` on the watched value** — `MapGeometry.Point` was declared `Equatable` from the start for exactly this reason (`ContactNodeView` watches `MapGeometry.positionOn(ring:index:)`'s result to decide whether to snap or animate).

**Deferred (honestly, not silently):**

- **MAP-07's 60fps-under-150-contacts claim is unverified by profiling.** The geometry math is exact and the node rendering is plain SwiftUI `Button`s in a `ZStack`/`ForEach`, not `Canvas` — the ios-specialist rules call out `Canvas`/Core Animation as the fallback if `Instruments` profiling shows jank at scale. No 150-contact fixture was built or profiled in this pass; if a future pass finds jank, the fix is swapping `RadialMapView`'s node rendering to a single `Canvas`, not touching `MapGeometry` (already pure/fast).
- **Clustering past ~150 contacts (OQ-MAP-1)** — explicitly out of scope per the spec's own open question; not attempted.
- **No UI/interaction tests** (tap-to-open-sheet, pinch/pan gesture behavior, animate-vs-snap timing) — same gap as Wave 1's onboarding views; this package has no UI test target. All carte logic that *can* be unit-tested without SwiftUI (`MapGeometry`, `EtatColors`, `CarteLabels`, the MAP-05 offline invariant) is tested; the SwiftUI glue is verified by code review + one live Simulator screenshot only.
- **FS-03 "grow-from-node" transition** — `PeekSheetView`'s « Ouvrir la fiche » stays a visibly disabled seam, per the task's explicit instruction not to build ahead of FS-03.

**apps/ios structure (additions only):**
```
apps/ios/
  Sources/SwabCore/Carte/{MapGeometry,EtatColors,CarteLabels,CarteTheme}.swift
  Sources/SwabUI/Carte/{ColorHex,CarteViewModel,RadialMapView,PeekSheetView,RingListView,CarteView,MainTabsView}.swift
  Tests/SwabCoreTests/{MapGeometryTests,EtatColorsTests,CarteLabelsTests,CarteOfflineInvariantTests}.swift
```

## 2026-07-10 — [ONB-01..09] App shell: hand-authored .xcodeproj, @main entry point, first Simulator boot

**What:** Added the previously-deferred app shell so `apps/ios` is installable and runnable on the iOS Simulator, without introducing any new tooling or third-party dependency.

- `apps/ios/App/SwabApp.swift` — the composition root. `@main struct SwabApp: App` → `RootView`, a `NavigationStack` that switches over `OnboardingStep` (`welcome → phone → contacts → calibrate → done → complete`) and instantiates each `SwabUI` view + its `SwabCore`-backed view model. Wired with real production types, not stubs: `KeychainSecureStore`, `FileKeyValueStore` (JSON at `Application Support/swab-store.v1.json`), `Session`, `VaultKeyStore`, `Vault`, `URLSessionHTTPTransport` + `ApiClient` pointed at `http://127.0.0.1:3001` (the local `docker compose` API — unreachable from a bare Simulator boot, so phone/otp screens exercise their existing `showError` path until the API is actually running; this is expected, not a bug). Contacts import uses `FakeContactsImporter(granted: false)` since the real `CNContactStore` importer is still deferred (unchanged from the Wave 1 entry).
- `apps/ios/SwabApp.xcodeproj/project.pbxproj` — hand-authored, plain-text pbxproj (`objectVersion = 56`, Xcode 26-compatible). One native target (`SwabApp`, `com.apple.product-type.application`) consuming the existing `Package.swift` as an `XCLocalSwiftPackageReference`, depending on the `SwabCore` and `SwabUI` library products via `XCSwiftPackageProductDependency`. This is genuinely Apple-native tooling (no `xcodegen`/CocoaPods) — the task's own framing confirms hand-authoring a `.xcodeproj` doesn't require G4 justification, same logic as any other in-tree config file.
- `apps/ios/SwabApp.xcodeproj/xcshareddata/xcschemes/SwabApp.xcscheme` — a shared scheme (checked in, not user-local) so `xcodebuild -scheme SwabApp` works non-interactively without ever having opened the project in the Xcode GUI first.
- Bundle ID `com.swab.ios`, deployment target iOS 17.0 (matches `Package.swift`'s `.iOS(.v17)`), `CODE_SIGNING_ALLOWED = NO` / `CODE_SIGNING_REQUIRED = NO` baked into every build configuration — no signing identity needed for Simulator builds. `Info.plist` is fully generated (`GENERATE_INFOPLIST_FILE = YES` + `INFOPLIST_KEY_*` build settings) rather than hand-written, including `INFOPLIST_KEY_NSContactsUsageDescription` ready for when the real `CNContactStore` importer lands.

**Why:** the user explicitly asked to see the app running on a Simulator — Wave 1 deliberately stopped short of this (see the entry below) to avoid `xcodegen` as an unjustified new dependency; a hand-authored `.xcodeproj` avoids that tradeoff entirely.

**Verified, honestly:**

- `xcodebuild -project SwabApp.xcodeproj -scheme SwabApp -destination 'platform=iOS Simulator,name=iPhone 17' -configuration Debug CODE_SIGNING_ALLOWED=NO build` → **BUILD SUCCEEDED** (after fixing one build error, see gotcha #8 below).
- `xcrun simctl boot 69A3D47E-99C3-45B7-8D84-4858EC4E709C` ("iPhone 17") + `open -a Simulator`, then `xcrun simctl install booted <DerivedData>/.../SwabApp.app` + `xcrun simctl launch booted com.swab.ios` → launched with a real PID, no crash reported by `simctl launch`.
- `xcrun simctl io booted screenshot` taken twice: once immediately after install (showed the **Phone** step, `Ton numéro` / "Il est haché sur ton téléphone avant tout envoi") because the Simulator's on-disk app container from an earlier attempt earlier the same day had already persisted `onboarding.step.v1 = phone` — this is `OnboardingStateStore`'s ONB-08 resume-at-step working correctly, not a bug. To get an unambiguous first-run screenshot, ran `xcrun simctl uninstall booted com.swab.ios` then reinstalled fresh: second screenshot shows the **Welcome** screen exactly as specified (ONB-01) — `swab · صواب`, "Dis ce dont tu as envie. À qui tu veux.", "Tout reste chiffré sur ton téléphone.", "Commencer" CTA. Both screenshots were >100KB (not a black/system-error frame).
- `xcrun swift test` re-run after the app shell existed: **55/55 tests pass, 0 failures** — the `App/` target is additive; it does not touch `SwabCore`/`SwabUI` sources.

**Gotchas discovered:**

7. **`XCLocalSwiftPackageReference.relativePath` is relative to the directory *containing* the `.xcodeproj` bundle, not to the bundle itself.** With `SwabApp.xcodeproj` living at `apps/ios/SwabApp.xcodeproj` (i.e. inside `apps/ios`, next to `Package.swift`), the correct `relativePath` to reference that same directory is `""` (empty string) — `".."` resolves one level too far up (to `apps/`, which has no `Package.swift`, and fails package resolution with a "manifest cannot be accessed" error naming the *wrong* parent directory). Cost one failed `xcodebuild -list` before pattern-matching the error text back to the pbxproj.
8. **`OnboardingStep` has no `.otp` case** — the persisted step intentionally stays `.phone` throughout the OTP exchange (see the Wave 1 entry's file header comment on `OnboardingState.swift`: "the step stays `.phone` until OTP verification succeeds"). The app shell's `RootView` therefore cannot switch on `step == .otp`; phone→otp sub-navigation is local `@State private var showingOtp: Bool` layered on top of the `.phone` case, not a persisted onboarding step. Caught immediately by the Swift compiler (`type 'OnboardingStep' has no member 'otp'`) on the first build attempt — no runtime debugging needed.
9. **A shared `.xcscheme` must be checked in for non-interactive `xcodebuild -scheme` to work.** Xcode auto-generates a user-local scheme the first time a project is opened in the GUI, but a project that has never been opened in Xcode (this one, built purely from the CLI) has no scheme at all unless one is committed under `xcshareddata/xcschemes/`. Wrote it by hand alongside the pbxproj; `BlueprintIdentifier` values must match the target's object ID exactly (`1A0000000000000000000002`) or `xcodebuild -list` silently omits the scheme.
10. **`GENERATE_INFOPLIST_FILE = YES` + `INFOPLIST_KEY_*` build settings fully replace a hand-written `Info.plist`** on modern Xcode (verified: no `Info.plist` file reference anywhere in the pbxproj, yet the built `.app/Info.plist` exists and is well-formed) — one fewer file to hand-author correctly.

**Still rough / not attempted here:**

- The API-dependent screens (phone OTP request, vault sync in `DoneViewModel.finish()`) were not exercised end-to-end against a running `docker compose up` API in this pass — only that they fail gracefully (`showError`) when the API is unreachable, which is the offline-first contract working as designed, not a gap. Exercising the full happy path against a live API is a follow-up manual check, not a blocker for "does it run."
- Real `CNContactStore` import, account deletion, multi-device, and contact-link invites remain deferred exactly as documented in the Wave 1 entry below — nothing in this pass changed that scope.
- No UI/snapshot tests were added for `App/SwabApp.swift` itself (it has no unit-testable logic of its own — it is pure wiring); `SwabUI` view/snapshot test coverage remains a deferral from Wave 1.

**apps/ios structure (additions only — see Wave 1 entry below for the rest):**
```
apps/ios/
  App/SwabApp.swift
  SwabApp.xcodeproj/
    project.pbxproj
    xcshareddata/xcschemes/SwabApp.xcscheme
```

Build/run from the CLI: `xcodebuild -project apps/ios/SwabApp.xcodeproj -scheme SwabApp -destination 'platform=iOS Simulator,name=iPhone 17' build`, then `xcrun simctl install booted <built .app>` + `xcrun simctl launch booted com.swab.ios`. Unit tests are unaffected: still `cd apps/ios && xcrun swift test`.

## 2026-07-10 — [VLT-01, VLT-02, VLT-04, IDT-01, IDT-02, IDT-06, ONB-01..09] Bootstrap apps/ios: Wave 1 (FS-07 client scope + FS-01 Onboarding)

**What:** Created `apps/ios` from scratch as a Swift Package (`SwabCore` + `SwabUI` + `SwabCoreTests`) — zero third-party dependencies, CryptoKit/Foundation/Security/SwiftUI/Observation only. TDD throughout: vault-test-vectors.json tests were written and run red before `VaultCrypto` existed.

- `Sources/SwabCore/Vault/VaultCrypto.swift` — AES-256-GCM wire format `base64(IV(12)‖TAG(16)‖CIPHERTEXT)`, with a `fixedIV` test-only seam. Reproduces every vector in `vault-test-vectors.json` exactly (`VaultCryptoTests`).
- `Sources/SwabCore/Identity/PhoneHash.swift` — `sha256("<salt>:<normalized>")` lowercase hex, default salt `swab-poc-phone-salt-v1`. Normalization restricted to ASCII `0`–`9` (see gotcha below).
- `Sources/SwabCore/Identity/SecureStore.swift` — `SecureStore` protocol; `KeychainSecureStore` (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, no iCloud sync) for production, `InMemorySecureStore` test double.
- `Sources/SwabCore/Vault/VaultKeyStore.swift` — get-or-create vault key under `swab.vault.key.v1` (ONB-02: created right after OTP verification).
- `Sources/SwabCore/Storage/KeyValueStore.swift` — `KeyValueStore` protocol; `FileKeyValueStore` (JSON file, actor-backed cache) for production, `InMemoryKeyValueStore` test double.
- `Sources/SwabCore/Vault/Vault.swift` — domain store: struct models (`VaultContact`, `VaultData`), fresh-copy accessors, version starts at 1 and increments on every persist.
- `Sources/SwabCore/Vault/VaultSync.swift` — push, 409 → re-pull server vault → retry once with `(serverVersion ?? local) + 1`, fail loudly (`VaultSyncError.conflictPersisted`) if the retry also conflicts.
- `Sources/SwabCore/Networking/ApiClient.swift` — `URLSession`-backed with an injectable `HTTPTransport` seam for tests; request bodies are exactly `OtpRequestBody`, `OtpVerifyBody`, `VaultPushBody` — no type for classification data exists in this file.
- `Sources/SwabCore/Identity/Session.swift` — session tokens (`swab.session.{access,refresh}.v1`) via `SecureStore`.
- `Sources/SwabCore/Onboarding/OnboardingState.swift` — `welcome → phone → contacts → calibrate → done → complete`, persisted under `onboarding.step.v1`, defaults to `.welcome`, falls back to `.welcome` on a corrupted persisted value.
- `Sources/SwabCore/Onboarding/PendingSignup.swift` — memory-only pending phone hash / dev code (lock-protected).
- `Sources/SwabCore/L10n/Fr.swift` — the full `apps/mobile/src/i18n/fr.ts` map ported verbatim (typographic apostrophes included), keyed by `I18nKey`.
- `Sources/SwabUI/Onboarding/*ViewModel.swift` (in `OnboardingViewModels.swift`) — MVVM `@Observable` view models for all six onboarding steps, composing only `SwabCore` types.
- `Sources/SwabUI/Onboarding/*View.swift` — SwiftUI screens (Welcome, Phone, Otp, Contacts, Calibrate, Done) using `Fr.t(...)` copy, `.accessibilityLabel` on every interactive element, leading/trailing-only layout (RTL-safe).
- `Sources/SwabUI/Onboarding/ContactsImporting.swift` — `ContactsImporting` protocol + `FakeContactsImporter`; real `CNContactStore` backing deferred (see below).

**Why:** Wave 1 of the RN → native migration (`docs/migration/rn-audit-map.md`) — crypto interop is the highest-risk item, de-risked first via the vector tests; onboarding is the first user-facing flow and depends on the vault/session/API layers.

**Test results:** `xcrun swift test` (run from `apps/ios`) — **55/55 tests pass, 0 failures.** Coverage on `SwabCore` (`Sources/SwabCore/**`, via `swift test --enable-code-coverage` + `llvm-cov report`, excluding test/derived files): **91.91% line coverage** (445 lines, 36 missed), well above the 80% DoD floor. `SwabUI` (view models/screens) is not separately coverage-measured in this PR — it has no unit tests of its own (see deferrals).

**Wave 1 parity checklist (`docs/migration/rn-audit-map.md`) — status:**

| Criterion | Status |
|---|---|
| Crypto vectors (`vault-test-vectors.json`) reproduced exactly | ✅ `VaultCryptoTests.test_VLT01_decryptsEveryVectorToItsExactPlaintext` / `test_VLT01_encryptWithFixedIVReproducesVectorBlobExactly` — all 3 AES vectors |
| Phone-hash vectors reproduced exactly | ✅ `VaultCryptoTests.test_IDT06_phoneHashVectorsMatchExactly` — all 4 vectors |
| Vault encrypted at rest; key in OS keystore; fresh-copy accessors (VLT-01) | ✅ `KeychainSecureStore` + `VaultTests.test_VLT01_getContactsReturnsFreshCopiesNotLiveReferences` / `test_VLT01_underlyingStorageNeverContainsPlaintextClassificationData` |
| Sync: push, 409 → re-pull + retry once (VLT-02) | ✅ `VaultSyncTests` (4 tests: success, conflict-then-success, conflict-with-no-server-vault, persisted-conflict-fails-loudly) |
| API client sends only `phoneHash`/`code`/`displayName`/`{blob,version}` (ONB-05, asserted via test) | ✅ `ApiClientPrivacyInvariantTests` — `Mirror`-based structural assertion over every `Encodable` request body |
| Onboarding flow welcome→phone→otp→contacts→calibrate→done (ONB-01..07), French copy verbatim | ✅ logic + French copy (`CopyEthosTests.test_verbatimSpotChecks` + full `Fr.swift` port); SwiftUI screens implemented but **not** independently unit/snapshot-tested (see deferrals) |
| Resume-at-step after process kill (ONB-08); step stays `phone` until OTP verified | ✅ `OnboardingStateTests` (fresh-store-instance-over-same-storage simulates restart) |
| Contacts denied → manual entry, identical capabilities (ONB-03) | 🟡 `ContactsViewModel.addManual` is fully capable standalone and covered by the view model's design, but the real `CNContactStore` importer is deferred — only `FakeContactsImporter` exists, so the "denied" path is exercised with a fake, not the real permission API |
| État/ressenti layer optional + collapsed (ONB-06); no gamification (ONB-09, asserted via copy test) | ✅ `CalibrateViewModel.optionalOpen` defaults `false`; `CopyEthosTests` (no digits outside `phone.placeholder`, no `%`, no gamification vocabulary) |
| Airplane-mode: calibration persists locally, syncs later, only `POST /vault` carries derived data | ✅ `Vault` writes require no network; `VaultSync.sync()` is the only path that touches the network and only ships `{blob, version}` |

**Gotchas discovered:**

1. **CryptoKit `AES.GCM.SealedBox.combined` order mismatch** — it's `IV ‖ CIPHERTEXT ‖ TAG`, but the wire format (inherited from `react-native-quick-crypto`'s `getAuthTag()`-appended-after-ciphertext convention) is `IV ‖ TAG ‖ CIPHERTEXT`. `VaultCrypto` never touches `.combined` — it builds/parses the three parts by hand from `nonce`/`sealed.tag`/`sealed.ciphertext`.
2. **Phone normalization must restrict to ASCII `0`–`9`**, not `Character.isNumber` — the latter also matches Arabic-indic and other Unicode digit sets, which would silently diverge from the RN reference's JS `\D` (ASCII-only under the non-unicode regex flag) and from the Android target. Got this right on the first vector run only because I checked the RN source before writing `normalize`.
3. **`swift` on the dev machine's `PATH` is shadowed by a Python `swiftclient` (OpenStack) package** (`/opt/homebrew/bin/swift`), not the Swift toolchain — every command in this PR was run as `xcrun swift build` / `xcrun swift test`, not bare `swift`. Worth noting for whoever runs this next.
4. **`Vault.getEncryptedVault()` version numbering**: a vault that has never been persisted shows version 2 (not 1) the first time `getEncryptedVault()` is called, because that call performs an implicit first `persist()` to materialize the blob, and `persist()` always increments before writing. This is inherited from `apps/mobile/src/vault/vault.ts` unchanged — documented and locked in `VaultTests.test_VLT01_versionIncrementsOnEveryPersist` rather than "fixed," per the instruction not to silently resolve known RN-reference quirks.
5. **Keychain access actually works from a bare `xcrun swift test` CLI process on this machine** (no code-signing entitlement needed for `kSecClassGenericPassword` items outside an access group) — `KeychainSecureStoreTests` genuinely exercises the Keychain rather than skipping, which was a pleasant surprise; the tests still degrade to `XCTSkip` on hosts where it doesn't (e.g. sandboxed CI runners), so this PR should stay green either way.
6. **SPM builds `SwabUI` even when running `swift test`**, since it's a sibling target in the same package graph — every SwiftUI/Observation API used had to compile on `macOS(.v14)` as well as `iOS(.v17)`, which meant guarding UIKit-only modifiers (`.keyboardType`) behind `#if os(iOS)`.

**Deferred (honestly, not silently):**

- **No `.xcodeproj` app shell / `@main App` composition root.** Per the task's explicit permission to defer this without new tooling (no `xcodegen` — that would be an unjustified new dependency, G4). `SwabUI` exports fully-formed, dependency-injected SwiftUI views and view models; wiring them into a `NavigationStack` behind an `App` entry point is the next PR once an Xcode project exists.
- **Real `CNContactStore`-backed `ContactsImporting`.** Needs `NSContactsUsageDescription` in an app bundle's `Info.plist`, which doesn't exist without an `.xcodeproj`. `FakeContactsImporter` stands in; the manual-add path in `ContactsViewModel` is fully functional on its own regardless of which importer is wired in, so ONB-03's "identical capabilities" acceptance criterion holds.
- **Full FS-02 `MapGeometry` port.** `CalibrateView` inlines a small subset of `apps/mobile/src/map/geometry.ts` (`ringRadius`/`positionOn`) as a private, unexported helper just enough to visually prefigure the map per ONB-04. The real `Features/Carte/MapGeometry.swift` module (Wave 2, per `rn-audit-map.md`) is out of scope here and will supersede this inlined copy.
- **No SwiftUI view/snapshot tests.** `SwabUI` view models and views compile cleanly on both `iOS` and `macOS` targets but have no `XCTest`/ViewInspector-style coverage in this PR — all 55 tests are `SwabCoreTests`. Every piece of logic the views call into (vault ops, API calls, state transitions) is tested at the `SwabCore` layer instead; the views themselves are thin bindings.
- **Account deletion (IDT-04), multi-device (IDT-05), contact-link invites (IDT-07..09)** — out of Wave 1 scope per `rn-audit-map.md`; not attempted.

**apps/ios structure:**
```
apps/ios/
  Package.swift
  Sources/SwabCore/{Vault,Identity,Storage,Networking,Onboarding,L10n}/*.swift
  Sources/SwabUI/Onboarding/*.swift
  Tests/SwabCoreTests/*.swift
  Tests/SwabCoreTests/Fixtures/vault-test-vectors.json  (copy of docs/migration/vault-test-vectors.json)
```

Not added to the pnpm/turbo pipeline (out of scope per task instructions) — run tests directly with `cd apps/ios && xcrun swift test`.
