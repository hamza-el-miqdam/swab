# apps/android — Changelog

Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, newest first (G5).

## 2026-07-11 — [ONB-01..09, MAP-01/02/04/06/08/09, FCH-01..08, VLT-01] Wave 4 — Compose UI E2E test suite + legacy-vault seed hook, driven end-to-end on a real emulator

### What

Added `app/src/androidTest/kotlin/com/swab/android/e2e/` — 14 instrumented Compose UI
tests across 5 classes (plus 1 shared driver file, `E2EFlows.kt`) that drive the real
app through Espresso/`compose-ui-test`, tapping and typing against the real Compose
tree (no ViewModel mocking), against the real local API stack (`docker compose up`,
`10.0.2.2:3001`):

- `OnboardingE2ETest` — ONB-01..08 happy path (Welcome → phone → OTP →
  display-name retry → manual contact add → calibrate rings 1/2 → Done → Carte);
  ONB-09 no-gamification: at every onboarding screen landing, scans the ENTIRE
  rendered semantics tree for percent signs and `X/Y` counter shapes
  (complements the JVM `NoGamificationCopyTest`, which only checks the static
  `Fr` table — this catches runtime-composed copy); plus a dedicated
  regression test for the Wave-1 `SignupViewModel` per-`composable{}`
  `remember` state-loss bug (asserts the real OTP screen renders instead of
  the `OTP_MISSING_PHONE` fallback).
- `RelationshipMapE2ETest` — MAP-01/04/08/09 (map rendering, peek sheet
  content + fiche-open enablement, list-mode grouping); MAP-02 (bottom nav
  exposes EXACTLY three Tab-role destinations — Carte/Envie/Sous-groupes,
  each genuinely navigable — and no digits-only "badge-shaped" text node
  exists on any of the three surfaces); MAP-06 (skip-contacts onboarding via
  « Passer » → empty Calibrate shows the calm `CALIBRATE_EMPTY` copy → Carte
  shows `CARTE_EMPTY` + centered « moi », with the same no-progress-framing
  scan as ONB-09); plus a dedicated regression test for the Wave-2
  `Float.toDp()` double-conversion density bug (measures a placed node's
  actual rendered pixel width against `MapGeometry.nodeSize(ring) * density`
  with tolerance, so a re-collapse reads as a hard failure instead of a
  visual-only regression nobody notices).
- `FicheE2ETest` — FCH-01..08 (open fiche from the map peek sheet, edit the
  Intimité axis, back out, re-open, edit persisted); FCH-04 (history starts
  empty after calibration — calibration writes rings without `recordAxisEdit`
  — then each fiche axis edit appends a visible event, and ordering is
  asserted newest-first by comparing the events' rendered y-positions);
  FCH-08 (a manually-added contact — `targetId = null`, i.e. every contact
  today since discovery has no Android client yet — shows
  `FICHE_PENDING_LABEL` + `FICHE_ENVIE_INACTIVE` while its axes stay
  genuinely editable: a real état edit selects, persists, and feeds history).
- `LegacyVaultCompatE2ETest` — VLT-01 backward compat, the Android twin of
  iOS's `--uitesting-seed-legacy-vault` XCUITest: seeds a PRE-FS-03-shaped
  vault blob (no `history` array, no `targetId`/`lastAxisChangeAt`/
  `staleSnoozedUntil` fields — the on-disk shape before commit 162b0c8)
  through the REAL crypto path, then launches the app and asserts it reaches
  Carte without crashing, the legacy contact renders on its ring, and its
  fiche opens with the empty history feed + pending state instead of a
  decode throw.
- `ActivityRecreationSmokeTest` — full Activity destroy/recreate (device
  rotation) after onboarding, asserting no crash and vault-backed contacts
  survive — same class of "state scoped to the wrong lifetime" bug as the
  Wave-1 nav fix, exercised one level up (Activity/process instead of
  NavBackStackEntry).

### Legacy-vault seed hook (`E2ESeedHooks`) — design + release safety

`LegacyVaultCompatE2ETest` needs "old bytes already on disk" before the app
first hydrates the vault. That is done by a debug-only seed hook, selected at
COMPILE time by build variant:

- `app/src/debug/kotlin/com/swab/android/E2ESeedHooks.kt` — the real
  implementation. On an opt-in Intent extra
  (`com.swab.android.e2e.SEED_LEGACY_VAULT`), it writes a hand-written
  pre-FS-03 JSON contact list through the REAL production crypto path — the
  actual `AndroidKeystoreVaultKeyStore.getOrCreateVaultKey()`
  (hardware-backed Keystore wrap key, `javax.crypto`) and the actual
  `VaultCrypto.encrypt` wire format (IV ‖ TAG ‖ CIPHERTEXT, base64) — into
  DataStore under the stable keys `vault.blob.v1` / `vault.version.v1`, plus
  `onboarding.step.v1 = complete` so launch lands on Carte. Nothing bypasses
  the encryption; only the JSON *shape* is deliberately old.
- `app/src/release/kotlin/com/swab/android/E2ESeedHooks.kt` — a no-op twin
  with an empty body.

Release-safety argument: this is NOT a runtime `if (BuildConfig.DEBUG)` gate —
the seeding code is **physically absent from release APKs** because the release
variant compiles the no-op source file instead (verified by disassembling the
compiled release class: zero references to vault/DataStore/crypto symbols).
Same exclusion class as iOS's `#if DEBUG`. Belt-and-braces, even a debug build
behaves identically to before unless the launching Intent carries the test-only
extra, which only `LegacyVaultCompatE2ETest` sets (via
`createEmptyComposeRule` + manual `ActivityScenario.launch(intent)` —
`createAndroidComposeRule` launches with a default Intent too early to attach
it). An Intent extra was chosen over an instrumentation-runner argument
because reading runner args from `src/main` would drag test infra into
production code; the extra keeps `src/main`'s only touchpoint a single call
into the variant-selected object at the top of `MainActivity.onCreate`
(before `AppContainer`, so the blob is on disk before anything hydrates).

`build.gradle.kts`: wired Android Test Orchestrator
(`testInstrumentationRunnerArguments["clearPackageData"] = "true"`,
`testOptions.execution = "ANDROIDX_TEST_ORCHESTRATOR"`,
`androidTestUtil("androidx.test:orchestrator:1.5.1")`) so every `@Test` gets
its own process and clean `DataStore`/vault state instead of sharing one
process across the whole `connectedAndroidTest` invocation.

### Real, verified run

Final run (2026-07-11): `./gradlew :app:clean :app:connectedDebugAndroidTest`
from clean, against a booted `Pixel_6_Pro` (API 34) AVD emulator and the live
`docker compose up` API stack (`curl http://localhost:3001/health` → 200).
**Final result: 16/16 instrumented tests passed, 0 failures, 0 errors,
0 skipped** (`BUILD SUCCESSFUL in 1m 55s`) — the 14 e2e tests above plus the
2 pre-existing `AndroidKeystoreVaultKeyStoreTest` cases (the Wave-1 Keystore
caller-supplied-IV-on-`ENCRYPT_MODE` regression guard, already instrumented
before this wave, unaffected by this change). JUnit XML under
`app/build/outputs/androidTest-results/connected/debug/`. Release compile
(`:app:compileReleaseKotlin`) also verified green with the no-op hook variant.
(An earlier 2026-07-10 run of the then-8-test suite was 10/10 green on the
same device.)

The first clean attempt (2026-07-10) surfaced two real problems that a
"should pass" report would have missed:

1. Two overlapping `connectedAndroidTest` invocations against the same
   device (one background, one foreground, launched a beat apart) corrupted
   each other's instrumentation session — read as `Process crashed` /
   `0 tests`. Not a product or test bug; resolved by never running more than
   one instrumentation session against a device at a time.
2. A genuine, reproducible `FicheE2ETest` failure on a real single-run
   attempt: `Failed to inject touch input... could not find any node that
   satisfies ContentDescription = 'Sam — Très proche'`. Root cause: the
   test's own comment claimed `CarteViewModel`'s contact list stays stale on
   return from Fiche (documented as an "intentional Wave-3 scope boundary"
   at authoring time) — false. `ui/carte/CarteScreen.kt`'s
   `LaunchedEffect(Unit) { viewModel.refresh() }` re-fires every time the
   Carte `composable {}` re-enters composition, including navigating back
   from Fiche, so the map's node label already shows the post-edit ring by
   the time the test re-selects it. Fixed the test to assert against the
   correct (refreshed) label instead of the stale one it originally assumed
   — see the updated comment in `FicheE2ETest.kt`. This was a stale test
   assumption, not an app bug; no `main`-app code changed for this fix.

### Regression coverage vs. the known Wave 1-2 bugs — what's covered and what isn't

- Emulator-to-host networking (`10.0.2.2`, not `localhost`): covered
  implicitly by every test in the suite — `BuildConfig.API_BASE_URL` is
  wired to `10.0.2.2:3001` (`app/build.gradle.kts`) and every onboarding
  flow round-trips through the real API.
- Compose `remember`-per-`composable{}` state loss (Wave 1, `SignupViewModel`
  hoisting fix): directly regression-tested,
  `OnboardingE2ETest.test_navigationStateLoss_phoneHashSurvivesPhoneToOtpTransition`.
- Android Keystore rejecting caller-supplied IV on `ENCRYPT_MODE`: already
  had a dedicated instrumented regression test,
  `AndroidKeystoreVaultKeyStoreTest` (pre-existing, not part of this wave's
  new files, but runs in the same `connectedAndroidTest` invocation and is
  included in the 16/16 count above).
- `Float.toDp()` double-conversion density bug (Wave 2, `MapGeometry`):
  directly regression-tested,
  `RelationshipMapE2ETest.test_densityRegression_placedNodeSizeIsNotCollapsed`.
- `CalibrateScreen.kt` ring-picker text-wrap bug (Wave 1, still open,
  `docs/migration/rn-audit-map.md`): **not** regression-tested — still open,
  out of scope for this wave. `OnboardingE2ETest`'s shared
  `completeOnboarding()` helper (`E2EFlows.kt`) deliberately only drives
  rings 1/2 during calibration and asserts (`require`) if a test tries rings
  3/4, so the suite doesn't silently pass by avoiding the buggy UI region —
  any future attempt to exercise rings 3/4 headlessly fails loudly with a
  pointer back to this note instead of hanging or mis-asserting.

### Deliberately NOT automated (and why) — honest gaps, not stubs

- MAP-05 (< 500ms first paint) and MAP-07 (60fps pan/zoom, ~150 contacts):
  performance numbers measured inside `compose-ui-test` on an emulator are
  noise, not evidence — needs a Macrobenchmark on real hardware.
- MAP-03 visual grammar and MAP-04's "grows from its map position" spatial
  continuity: purely visual/animated qualities with no semantics-tree
  signature; the navigation seam itself IS covered (peek sheet → fiche).
- FCH-05 staleness nudge (6-month threshold, 30-day snooze): needs time
  travel; `FicheViewModel.nowProvider` is only injectable in JVM unit tests
  (covered there), and faking the device clock under Orchestrator isn't
  reliable. Not driven E2E.
- FCH-04 "relationship events (matches)": no FS-04/05 data source exists yet
  (`VaultHistoryEvent.axis = null` reserved) — only axis-edit events are
  assertable today, and are.
- ONB-03 device-contact import: `onImportContacts` is deliberately unwired in
  this build (permission-gated picker lands later); only the manual-add path
  is exercisable headlessly.
- ONB-09's "no confetti/celebration": the E2E scan covers rendered TEXT
  (percent/counter shapes); a celebratory *animation* would not be caught —
  no such component exists in the codebase to assert against.

### Gotchas for future changes to this suite

- Each `@Test` needs a fresh phone number (`uniquePhoneNumber()` in
  `E2EFlows.kt`) — the API throttles OTP requests per phone hash (max 3 per
  5-minute window) and a reused number also skips the `needsName` branch the
  onboarding flow exercises.
- Never launch two `connectedAndroidTest` (or `connectedAndroidTest` +
  Android Studio's own instrumented run) invocations against the same
  device concurrently — see problem 1 above.
- `waitUntilSelected` (`E2EFlows.kt`) intentionally reads the **merged**
  semantics tree (unlike the other `waitUntil*` helpers, which use
  unmerged) — `Selected` lives on `FilterChip`'s merged parent node, not the
  raw child `Text` node.

## 2026-07-10 — [FCH-01..08] FS-03 Contact Card (Wave 3) — greenfield fiche screen, vault history + staleness

### What

FS-03 has no RN reference (never built in `apps/mobile`) — built natively from
`docs/specs/FS-03-contact-card.md` alone. Wires the FS-02 seam: `PeekSheet`'s
« Ouvrir la fiche » button (previously rendered visibly disabled) now
navigates to `fiche/{contactId}`.

- `vault/Vault.kt` — extended the FS-07 model to carry what FS-03 needs, all
  still inside the one encrypted `VaultData` blob:
  - `VaultContact.targetId: String?` (mirrors FS-07's `ContactLink.targetId`,
    IDT-07). ⚠️ ASSUMPTION: defaults to `null` for every contact, because
    contact discovery (IDT-06) has no Android client yet — every contact is
    honestly "pending" today, not a placeholder guess, so FCH-08's envie
    ineligibility indicator is correct out of the box.
  - `VaultContact.lastAxisChangeAt` / `staleSnoozedUntil` (epoch millis) —
    drive FCH-05.
  - `VaultData.history: List<VaultHistoryEvent>` + `Vault.recordAxisEdit`,
    `getHistory`, `confirmStillAccurate`, `snoozeStaleness`, `setRoles`
    (roles had no setter before FS-03). `recordAxisEdit` stamps
    `lastAxisChangeAt` and appends a history event atomically (one lock
    acquisition — can't reuse the existing private `mutateContact`, which
    takes its own non-reentrant lock).
- `fiche/FicheStaleness.kt` — pure (no Android imports, same rule as
  `carte/MapGeometry.kt`) FCH-05 timing: due for a nudge only if an axis was
  ever edited, that edit is ≥6 months old (⚠️ ASSUMPTION, flagged by the spec
  itself), and no active 30-day « À revoir plus tard » snooze covers now.
- `fiche/FicheFilterConsequence.kt` — FCH-06 informational-only "état → FS-06
  consequence" text (FS-06 itself isn't built; nothing here filters real
  recipients). ⚠️ KNOWN DIVERGENCE, documented in the file: this task's brief
  says reuse the shipped 3-value ÉTAT set (disponible/occupé/ailleurs) as-is,
  but FCH-06 requires the blueprint's `en pause` specifically — which today
  ships under RESSENTI, not ÉTAT (EtatColors.kt's already-flagged 3-vs-5-état
  divergence, rn-native-handoff.md §5, not resolved by this task). Resolved
  by checking both axes' current values for `en pause` rather than inventing
  a new état option nobody asked for here.
- `fiche/FicheViewModel.kt` — loads one contact + its 12-month history window
  from the vault only (never network — enforced structurally by
  `FicheOfflineStructuralTest`, mirroring `CarteOfflineStructuralTest`
  MAP-05). Every axis setter (`setIntimite/setRoles/setEtat/setRessenti`)
  writes to the vault immediately and appends a history event in the same
  call (FCH-01, optimistic + offline-capable by construction — there's no
  network call to be offline *from*).
- `ui/fiche/FicheScreen.kt` — the four tap-editable axes (`FilterChip` per
  option), the FCH-04 history feed (newest first), and the FCH-05 nudge as an
  inline `Card` at the foot of the screen — never an `AlertDialog`, matching
  « jamais bloquant ». FCH-08: pending contacts (`targetId == null`) get the
  identical fully-editable fiche, plus two extra lines noting they haven't
  joined and envie is inactive. Rôles·contexte options (Famille / Amitié /
  Travail / Voisinage / Autre) are OQ-FCH-1's placeholder taxonomy, flagged
  ⚠️ ASSUMPTION in both `Fr.kt` and the screen file.
- `MainActivity.kt` — new `fiche/{contactId}` route, a leaf destination (not
  hoisted to `SwabNavHost` scope like `carteViewModel`, since it isn't shared
  between sibling tabs). FCH-07 (back preserves map position) falls out of
  existing `Navigation-Compose` behavior for free: pushing `fiche` on top of
  `carte` never disposes `carte`'s composition, so `RadialMap`'s remembered
  pan/zoom state is still there on `popBackStack()` — no extra plumbing
  needed, confirmed by reading how `RadialMap.kt` remembers `scale`/`offsetX`/
  `offsetY`.
- `ui/carte/PeekSheet.kt` — per the brief, ONLY the button's `onClick` and
  disabled state changed (added an `onOpenFiche` parameter); the rest of the
  peek sheet is untouched.
- `l10n/Fr.kt` — new `FICHE_*` constants, added to `ALL_STRINGS`
  (`NoGamificationCopyTest` covers them automatically).

### Deviations from the brief (with reasoning)

- **No reciprocity signal is rendered at all (FCH-03).** The spec makes one
  optional ("if shown"). FCH-02 requires nothing on the fiche ever imply the
  other person's classification is visible — any soft qualitative copy here
  risks being misread as "they feel this way too." Omitting it is the only
  reading with zero leak risk; there was nothing safe to show.
- **FCH-04 relationship events (matches, coarse-grain) are deferred.** FS-04/
  05 (envie/match flow) don't exist yet, so there is no local data source for
  them. The vault schema is ready (`VaultHistoryEvent.axis = null` reserved
  for this), only axis-change events are wired today.
- **FCH-06's état/en pause conflict** — see `FicheFilterConsequence.kt` above;
  resolved by checking both axes rather than picking one brief instruction
  over the other outright.

### Tests

108 JVM unit tests total (`./gradlew test`), all green. Jacoco domain-layer
coverage (same `jacocoDomainCoverage` task as Wave 1/2, UI/platform-glue
excluded per that task's existing exclusion list): 98.32% lines overall,
100% for the new `fiche` package. New coverage: `VaultTest` (setRoles,
recordAxisEdit, getHistory, confirmStillAccurate, snoozeStaleness, FCH-08
default-pending contact), `FicheStalenessTest`, `FicheFilterConsequenceTest`,
`FicheViewModelTest` (all four axis writes, history ordering + 12-month
window, staleness nudge appear/reset/snooze/re-eligibility, FCH-08 pending
contact stays fully editable), `FicheOfflineStructuralTest` (network-import
scan, mirrors MAP-05's `CarteOfflineStructuralTest`), and
`FichePrivacyLeakTest` — drives all four axis edits through the real
`FicheViewModel` → `Vault` → `VaultSync` → `ApiClient` path with a recording
`HttpTransport` and asserts the literal request body contains none of the
plaintext values, axis labels, or field names used (the FS-03 acceptance
criterion, stronger than `VaultTest`'s existing generic "no plaintext"
check).

## 2026-07-10 — [MAP-01..09] FS-02 Relationship Map (Wave 2) — radial carte, list fallback, 3-tab nav

### What

Ported FS-02 (`apps/mobile/src/map/*`, `app/(main)/carte.tsx`, `app/(main)/_layout.tsx`,
`src/ui/nav-bar.tsx`) natively, 1:1 behavior parity with the RN reference.

- `carte/MapGeometry.kt` — pure Kotlin (no Android/Compose imports) port of
  `geometry.ts`: `MAP_SIZE=320`, rings `[1,2,3,4]`, `ringRadius`, `positionOn`
  (golden-angle `2.399963` placement), `clamp`, `panBound`, `nodeSize`.
- `carte/EtatColors.kt` — the 3 shipped états (`disponible`/`occupé`/`ailleurs`)
  mapped to the blueprint hex colors; returns hex strings + nulls (not Compose
  `Color`) so it stays platform-free. **Flagged divergence carried forward
  unchanged, per rn-native-handoff.md §5: the blueprint's 5-état taxonomy vs
  the shipped 3 — not resolved here.**
- `carte/Labels.kt` — `RING_LABEL`, `contactLabel` (« Léa — Très proche »),
  `initials` (up to 2, uppercased).
- `carte/CarteViewModel.kt` — loads/refreshes from `Vault` only; MAP-05
  (offline by construction) is enforced structurally by
  `CarteOfflineStructuralTest`, which scans `carte/` and `ui/carte/` sources
  for any `com.swab.android.network` import or HTTP primitive.
- `ui/carte/RadialMap.kt` — rings + spokes drawn in one `Canvas` (perf rule:
  not one composable per ring); `moi` centered; one lightweight composable
  per placed contact (own tap target + TalkBack label + independent
  animation — Canvas can't host per-node semantics/gestures, so nodes stay
  outside it, same split as the RN reference's View+Pressable architecture).
  Pinch-zoom (1x–3x) + bounded pan via `detectTransformGestures`. A contact's
  first mount snaps in place; only later ring/index changes animate
  (`Animatable` + `tween(350ms)`, `hasMounted` tracked per contact id via
  `remember(contact.id)`, RN's `mounted` ref ported 1:1).
- `ui/carte/PeekSheet.kt` — Material 3 `ModalBottomSheet` (already a
  transitive compose-bom dependency — no new dep, G4) showing
  Intimité/État/Rôles; « Ouvrir la fiche » rendered visibly **disabled**
  (FS-03 seam, not built).
- `ui/carte/RingList.kt` — `LazyColumn` grouped by ring (MAP-08), unplaced
  contacts get their own trailing untitled section, each row carries
  `Labels.contactLabel` via `Modifier.semantics`.
- `ui/carte/CarteScreen.kt` + `ui/nav/BottomNav.kt` — map/list toggle, calm
  empty state, unplaced-contacts tray, legend toggle; `NavigationBarItem`
  takes a `label` only, so no badge/counter can be rendered on the 3 tabs
  by construction (MAP-02) — enforced by `BottomNavStructuralTest`.
- `MainActivity.kt` — `Routes.CARTE/ENVIE/SOUS_GROUPES` wired into
  `SwabNavHost`, replacing the Wave-1 placeholder; `CarteViewModel` hoisted
  to `SwabNavHost`'s scope (same rule as `signupViewModel` — Carte/Envie/
  Sous-groupes are sibling `composable {}` destinations, so a per-destination
  `remember` would tear it down on every tab switch). `Fr.kt` already had
  every `carte.*`/`nav.*`/`envie.*`/`sousgroupes.*` string from Wave 1's
  bootstrap — no new copy needed.

### A real bug found and fixed via the on-device walkthrough (not caught by JVM tests)

`RadialMap` rendered correctly in concept but was **visually broken on a real
high-density device**: on the `Pixel_6_Pro` emulator (density 3.5x,
`wm density` → 560), the map collapsed to roughly 1/3.5 of its intended
320dp size and contact nodes shrank to ~13dp, while `moi`'s hardcoded
`44.dp` circle did not shrink — so Léa's node appeared to sit almost
entirely inside `moi`. Root cause: `MapGeometry`'s numbers are
dp-equivalent units (a 320-unit canvas is meant to render as a 320dp box),
but the code converted them with `Float.toDp()`, which treats its input as
**raw device pixels** and divides by density — a double conversion. Same
class of bug in two places, two different fixes:
- Outside the `Canvas` (`RadialMap`'s container size, `ContactNode`'s
  offset/size): `MapGeometry` units are dp — wrap with `.dp` directly, not
  `Float.toDp()`.
- Inside the `Canvas` (`RingsAndSpokes`): a `DrawScope` draws in raw pixels,
  so `MapGeometry` units are multiplied by the `DrawScope`'s own `density`
  (px = dp × density) before being passed to `drawCircle`/`drawLine`.
- Same fix applied to the pinch/pan bound: `pan.x/y` from
  `detectTransformGestures` and `graphicsLayer`'s `translationX/Y` are both
  raw pixels, so `MapGeometry.panBound(scale)` (dp-equivalent) is multiplied
  by `density` before being used as the pixel clamp.

No JVM unit test could have caught this — `MapGeometryTest` verifies the
pure math is internally self-consistent (which it is), and Robolectric
isn't in this project's stack; only a real device/emulator with a
non-1.0 density exposes the mismatch. Verified fixed with a before/after
screenshot pair on the same emulator (see walkthrough section below).

### Test results

`./gradlew test`: **80/80 passing** (47 Wave-1 + 33 new: `MapGeometryTest`
10, `EtatColorsTest` 5, `LabelsTest` 6, `CarteViewModelTest` 5,
`CarteOfflineStructuralTest` 2, `CarteEthosCopyTest` 3,
`BottomNavStructuralTest` 2). No regressions.
`./gradlew jacocoDomainCoverage`: **98.4%** line coverage overall; the new
`com/swab/android/carte` package is **100%** (52/52 lines) — the `ui/carte`
and `ui/nav` Compose files are excluded from the gate the same way all
other UI packages are (needs an emulator/instrumented test to exercise
meaningfully; the on-device walkthrough below is the closest substitute in
this environment).

### On-device walkthrough (real, not simulated)

Built `./gradlew assembleDebug`, installed on the already-running
`Pixel_6_Pro` emulator (`emulator-5554`) via `adb install -r`, and drove the
**entire** flow non-interactively with `adb shell input` + `uiautomator
dump` (same technique as the Wave-1 walkthrough): welcome → phone → OTP
(dev-mode code shown in-app, against the live `apps/api` from
`docker compose up`) → added 2 manual contacts (Léa, Nadia) → calibrate,
placed Léa on ring 1 and Nadia on ring 3 → done → **landed on the new Carte
screen**. Confirmed via `uiautomator dump` + screenshots (before the density
fix and after):
- Radial map renders with 4 ring circles, 4 spokes, `moi` centered, both
  contacts positioned and correctly sized per ring (after the fix).
- Tapping a contact node opens the peek sheet with correct Intimité/État/
  Rôles and a visibly disabled « Ouvrir la fiche ».
- List-mode switch toggles to `RingList`, showing ring-header-grouped rows
  (Très proche → Léa, Familier → Nadia) — feature-equivalent to the map.
- Bottom nav (Carte/Envie/Sous-groupes) navigates correctly, correct tab
  highlighted, both placeholder screens render their calm copy.
- `adb logcat` checked after every step: **zero exceptions**, no
  `FATAL EXCEPTION`/`AndroidRuntime` crash lines anywhere in the run.

### MAP-01..09 status

MAP-01 (radial layout from vault) ✅ live. MAP-02 (exactly 3 nav
destinations, no badges) ✅ live + structurally enforced. MAP-03 (état/ring
visual encoding, flagged 3-vs-5 divergence) ✅. MAP-04 (tap → peek sheet,
animated not teleported re-tag) ✅ animation implemented and unit-tested
(`hasMounted` gate); the actual FS-03 fiche navigation is out of scope by
design (disabled button, seam only). MAP-05 (offline by construction) ✅
live + structurally enforced. MAP-06 (calm empty/sparse state) ✅ copy
wired, not exercised live (both test contacts were placed — an empty-vault
run was not walked on-device this session). MAP-07 (150-contact density,
60fps pan/zoom) ✅ geometry proven at n=150 in `MapGeometryTest`; a live
60fps/150-contact perf run was **not** done (no Perfetto profiling in this
session — deferred, same as Wave 1's non-functional perf claims). MAP-08
(TalkBack list fallback) ✅ live (list mode screenshot-verified; a real
TalkBack screen-reader pass was not run, only the semantics/content-desc
wiring was verified structurally and via `uiautomator dump`'s
`content-desc` output). MAP-09 (no search/sort/ranking) ✅ structurally
enforced (`CarteEthosCopyTest`) and true by construction (no `TextInput`/
search field exists in `CarteScreen`).

### Deferred / out of scope (do not attempt without a product decision)

- Clustering past ~150 contacts (OQ-MAP-1) — explicitly deferred per spec.
- FS-03 fiche navigation and the "grow-from-node" spatial-continuity
  transition — the peek sheet's button is wired disabled, nothing more.
- A dedicated Compose UI/instrumented test suite for `ui/carte`/`ui/nav` —
  the domain layer (geometry/colors/labels/view model) has 100% JVM
  coverage; the Compose layer is verified only via the live walkthrough
  above and structural source-scanning tests, consistent with how Wave 1
  treated `ui/onboarding`.

## 2026-07-10 — [VLT-01, IDT-01, ONB-02] On-device walkthrough: emulator base URL, a real Keystore bug, and its fix

Closed the two gaps `rn-audit-map.md` flagged as 🟡 for Android by actually
running the app against a live `apps/api` (`docker compose up`) on a
`Pixel_6_Pro` emulator and walking welcome → phone → OTP → new-user name →
contacts end to end.

**Emulator can't reach `localhost` on the host — needed `10.0.2.2`:**
- `ApiClient.DEFAULT_BASE_URL` (`http://localhost:3001`) resolves to the
  emulator's own loopback, not the Mac running Docker. Added a
  `BuildConfig.API_BASE_URL` field per build type (`debug` →
  `http://10.0.2.2:3001`, the AVD's host-loopback alias; `release` → a
  placeholder `https://api.swab.app` for later) and wired it through
  `AppContainer`.
- Cleartext HTTP is blocked by default on API 28+. Added a **debug-only**
  network security config (`src/debug/res/xml/network_security_config.xml`
  + `src/debug/AndroidManifest.xml`) permitting cleartext to `10.0.2.2` and
  `localhost` only — the release manifest is untouched, so this never
  weakens a real build (G1 least-privilege).

**Real bug found and fixed — `AndroidKeystoreVaultKeyStore` threw on first
vault-key creation:** `java.security.InvalidAlgorithmParameterException:
Caller-provided IV not permitted` at the `Cipher.init(ENCRYPT_MODE, ...)`
call wrapping the vault key. Android Keystore AES/GCM keys are generated
with randomized encryption **required** by default — the provider refuses a
caller-supplied `GCMParameterSpec(iv)` on `ENCRYPT_MODE` and throws instead
of just ignoring it. Fix: `cipher.init(Cipher.ENCRYPT_MODE, wrapKey.key)`
with no spec, then read the Keystore-chosen IV back via `cipher.iv`
afterwards. `DECRYPT_MODE` has no such restriction and was already correct.
This only reproduces against the real Keystore provider — added
`app/src/androidTest/kotlin/.../AndroidKeystoreVaultKeyStoreTest.kt` (2
tests: key generation doesn't throw, key is stable across calls) as a
regression guard, run via `./gradlew connectedDebugAndroidTest`.

**A second, unrelated bug surfaced during the same walkthrough and was
fixed:** `MainActivity`'s `SwabNavHost` called `rememberSignupViewModel`
separately inside the `PHONE` and `OTP` `composable { }` blocks. Compose
scopes `remember` to the individual `NavBackStackEntry`, so navigating
Phone → OTP created a **second, fresh** `SignupViewModel` with empty
`PendingSignup` state, discarding the phone hash just set on the Phone
screen — the OTP screen then showed `otp.missingPhone` ("Reprenons depuis
ton numéro.") on every normal run, not just on a genuine process restart as
intended (ONB-08's actual contract). Fixed by hoisting one shared
`signupViewModel` instance to `SwabNavHost`'s own scope, above `NavHost`,
so it survives navigation between the two screens.

**Verified end to end against the live API:** `POST /auth/otp/request` →
`200`; `/auth/otp/verify` first attempt correctly returns `422`/`needsName`
for a new user; second attempt with a display name returns `200`,
`isNewUser: true`; app navigates to the Contacts screen
(`Qui compte pour toi ?`). `AndroidKeystoreVaultKeyStore.getOrCreateVaultKey()`
(called right after verify per ONB-02) no longer throws. No exceptions in
logcat across the full run.

**Test results after these fixes:** `./gradlew test` still 47/47;
`./gradlew connectedDebugAndroidTest` 2/2 new instrumented tests pass on
the `Pixel_6_Pro` emulator.

## 2026-07-10 — [VLT-01, VLT-02, VLT-04, IDT-01, IDT-02, IDT-06, ONB-01..09] Bootstrap apps/android, Wave 1 (FS-07 client scope + FS-01 Onboarding)

### What

Created `apps/android` from scratch: Gradle Kotlin DSL, single `:app` module,
Jetpack Compose UI, MVVM (`ViewModel` + `StateFlow`, unidirectional data
flow). Domain code (crypto, phone hash, vault, sync, API client, onboarding
state machine, French copy) is plain Kotlin with no Android imports, so it
runs as ordinary JVM unit tests — no emulator, no Robolectric.

**Crypto core (TDD, vectors first):**
- `vault/VaultCrypto.kt` — AES-256-GCM via `javax.crypto.Cipher
  ("AES/GCM/NoPadding")`. `java.util.Base64` (standard alphabet, padding).
  Wire format `base64(IV(12) ‖ TAG(16) ‖ CIPHERTEXT)`; `Cipher.doFinal`
  returns `CIPHERTEXT ‖ TAG` on the JVM, so encrypt/decrypt both reorder the
  tag around the ciphertext to match the cross-platform contract.
- `identity/PhoneHash.kt` — `sha256("<salt>:<normalized>")` lowercase hex,
  default salt `swab-poc-phone-salt-v1`, normalization ported 1:1 from
  `apps/mobile/src/lib/phoneHash.ts` (keep leading `+`, strip everything
  else).
- Contract tests: `vault/VaultCryptoVectorTest.kt`,
  `identity/PhoneHashVectorTest.kt` against a **copy** of
  `docs/migration/vault-test-vectors.json` placed at
  `app/src/test/resources/vault-test-vectors.json` (this module cannot write
  outside `apps/android/**`, so the fixture is duplicated rather than
  referenced by relative path — keep both in sync if the vectors file
  changes upstream).

**Vault + sync + API client (FS-07 client scope):**
- `vault/Vault.kt` — data classes + immutable lists, fresh-copy accessors
  (VLT-01 aliasing regression guard), version starts at 1 and increments on
  every persist.
- `vault/VaultKeyStore.kt` (interface) + `vault/InMemoryVaultKeyStore`
  (JVM test fake) + `vault/AndroidKeystoreVaultKeyStore` (production —
  envelope encryption: a non-exportable AES-256-GCM key lives in the Android
  Keystore and wraps a portable 32-byte vault key, because the vault key
  itself must stay raw/exportable to satisfy the cross-platform vector
  contract, which an actual Keystore key handle cannot do).
- `network/ApiClient.kt` over `network/HttpTransport` (interface) +
  `network/HttpUrlConnectionTransport` (production, `java.net.HttpURLConnection`
  — no OkHttp; G4: four JSON endpoints don't justify the dependency).
  Request/response DTOs are a closed set (`phoneHash`/`code`/`displayName`/
  `{blob,version}`) — there is no Kotlin type anywhere in this layer for
  rings/roles/état/ressenti/scope names, asserted by
  `network/ApiClientTest.kt` and `vault/VaultSyncTest.kt`.
- `vault/VaultSync.kt` — push, 409 → re-pull server version, retry once with
  `(serverVersion ?? localVersion) + 1`, fail loudly if still conflicting.
- `identity/Session.kt` (interface) + `InMemorySecureTokenStore` (JVM fake)
  + `identity/KeystoreTokenStore` (production, backed by the same
  DataStore-based `KeyValueStore` as the vault blob).
- `storage/KeyValueStore.kt` (interface) + `InMemoryKeyValueStore` (JVM
  fake) + `storage/DataStoreKeyValueStore` (production, Jetpack DataStore —
  acceptable per `rn-audit-map.md` since the vault blob it stores is already
  ciphertext and the onboarding step is not classification data).

**Onboarding (FS-01):**
- `onboarding/OnboardingState.kt` — `welcome → phone → contacts → calibrate
  → done → complete`, persisted under `onboarding.step.v1`; unrecognized
  values fall back to `welcome`.
- `onboarding/PendingSignup.kt` — memory-only pending phone hash / dev OTP
  code (restart between phone and OTP re-asks the number, matching the RN
  reference).
- `onboarding/SignupViewModel.kt` — phone submit hashes on-device before any
  network call; OTP verify saves tokens, creates the vault key **before**
  any classification input is possible (ONB-02), then advances the step to
  `contacts`; a 422 response reveals the `needsName` field instead of a
  generic error (matches the RN reference's new-user-without-name path).
- `onboarding/OnboardingViewModel.kt`, `ContactsViewModel.kt`,
  `CalibrateViewModel.kt` — MVVM wrappers around `Vault`/`OnboardingStateStore`.
  Calibration writes ring/état/ressenti to the vault only — no network call
  exists in `CalibrateViewModel`, by construction (ONB-05).
- `l10n/Fr.kt` — every string from `apps/mobile/src/i18n/fr.ts` ported
  verbatim, including typographic apostrophes (’). `l10n/NoGamificationCopyTest.kt`
  scans all strings for percentage signs / félicitation / bravo / streak /
  badge / "niveau N" patterns (ONB-09).
- Compose screens (`ui/onboarding/*Screen.kt`) for welcome, phone, otp,
  contacts, calibrate, done, wired into a single `NavHost` in
  `MainActivity.kt`. The resume gate reads the persisted step on launch
  (ONB-08) before choosing the nav graph's start destination. Layouts use
  `start`/`end` padding only (no hardcoded left/right), Compose semantics
  content-descriptions on every interactive element.
- Calibration v0 interaction is select-then-tap-a-ring-button (list-style),
  matching the RN reference's own note that full drag/radial-canvas
  interaction ships with FS-02 (Wave 2) — this is not a regression, it
  mirrors the RN reference's stated v0 scope.

### Why

Per `docs/migration/rn-native-handoff.md`, FS-07's client scope + FS-01 is
Wave 1: crypto interop is the highest-risk piece and had to be de-risked
against `vault-test-vectors.json` before anything else was built on top of
it. Domain code is kept import-free of Android so the whole business-logic
surface is covered by fast JVM unit tests instead of requiring an emulator.

### Test results

`./gradlew test` — **47 tests, 0 failures, 0 errors, 0 skipped** (debug unit
test variant; release variant duplicates the same 47 and is also green).
Domain-code line coverage (see `jacocoDomainCoverage` task, excludes Compose
UI, `MainActivity`, `AppContainer` manual-DI wiring, and the Android-Keystore
/DataStore production adapters that need a real device): **98.1% (371/378
lines)**.

### Gotchas

- **KDoc `/*` trap:** a doc comment containing the literal substring `/*`
  (e.g. `apps/mobile/src/ui/*.` — the `ui/*` fragment) opens a *nested*
  Kotlin block comment that never closes, silently swallowing the rest of
  the file and producing a cascade of unrelated "unresolved reference"
  errors in every file that imports from it. Hit this once in
  `ui/onboarding/Primitives.kt`; fixed by rewording. Worth a project-wide
  grep (`grep -rn '/\*' --include='*.kt'`, excluding literal `/**` doc-comment
  openers) if this recurs.
- **`platform(...)` scope:** `platform("androidx.compose:compose-bom:...")`
  must be called inside the `dependencies { }` block, not hoisted to a
  top-level `val` in the build script — Gradle's Kotlin DSL only resolves
  the `platform` extension function within that scope.
- **GCM tag ordering:** `Cipher.doFinal` on encrypt returns `CIPHERTEXT ‖
  TAG`, but the cross-platform wire format is `IV ‖ TAG ‖ CIPHERTEXT`. Miss
  this and every vector test fails with a garbled/undecryptable blob instead
  of a clean auth-tag mismatch, which cost time to diagnose — the reorder is
  now commented in `VaultCrypto.kt` at both encrypt and decrypt.
- **`viewModelScope` + JVM unit tests:** `ViewModel.viewModelScope` uses
  `Dispatchers.Main.immediate`, which doesn't exist on the plain JVM test
  classpath. Added `MainDispatcherRule` (test-only, `app/src/test/kotlin/com/swab/android/MainDispatcherRule.kt`)
  swapping in a `StandardTestDispatcher` via `Dispatchers.setMain`/`resetMain`
  — required for `SignupViewModel`/`OnboardingViewModel`/`ContactsViewModel`/
  `CalibrateViewModel` tests to run without Robolectric.
- **Gradle/AGP version pins:** Gradle **8.13** (a distribution was already
  cached at `~/.gradle/wrapper/dists/gradle-8.13-bin/...` in this
  environment; the wrapper jar/properties were generated by running that
  cached `gradle` binary directly with `gradle wrapper --gradle-version
  8.13`, since no `gradle` was on `PATH` — see "Gradle bootstrap" below).
  AGP **8.5.2** + Kotlin **2.0.21** (matches the Compose compiler Gradle
  plugin approach — no separate `composeOptions.kotlinCompilerExtensionVersion`
  needed with Kotlin 2.0's `org.jetbrains.kotlin.plugin.compose`). Compose
  BOM **2024.09.00**. `compileSdk = 35` triggers an AGP 8.5.2 "untested
  compileSdk" warning (non-fatal) since AGP 8.5.x was validated up to 34;
  left as-is rather than pinning down to 34, since SDK platform 35 was
  already installed in this environment and everything compiles/runs clean.
- **Android Gradle Plugin auto-installed Build-Tools 34** on first run
  (accepted its license non-interactively via the Gradle build itself) even
  though 35/36.1/37 were already present locally — AGP 8.5.2's default
  build-tools resolution wanted exactly 34.0.0.

### Deferred (documented, not silently dropped)

- **On-device verification of `AndroidKeystoreVaultKeyStore`,
  `DataStoreKeyValueStore`, `KeystoreTokenStore`, `HttpUrlConnectionTransport`,
  and all Compose screens/`MainActivity`.** This environment has the Android
  SDK (platforms, build-tools) but no running emulator/AVD and no connected
  device, so nothing requiring `androidx.test`/instrumentation could be
  exercised. These classes compile (including against the real
  `android.security.keystore`/`androidx.datastore` APIs) but are excluded
  from the coverage gate and have not been run. `Vault`/`VaultSync`/
  `ApiClient`/onboarding logic ARE fully exercised via their JVM-testable
  interfaces (`InMemoryVaultKeyStore`, `InMemoryKeyValueStore`,
  `InMemorySecureTokenStore`, a scripted `HttpTransport` fake) — the
  production adapters are thin enough (envelope-encrypt/decrypt around a
  Keystore key; DataStore get/set; HttpURLConnection request/response) that
  the risk is judged low, but it is unverified, not verified.
- **Compose UI tests** (`androidTest`) — none written. The `androidTest`
  source set and its dependencies (Espresso, Compose UI test JUnit4) are
  wired in `app/build.gradle.kts` but no test class exists yet; needs an
  emulator to run regardless.
- **Device contact import (ONB-03 import path)** — `ContactsScreen`'s
  `onImportContacts` callback is a no-op stub; the permission request +
  `ContentResolver` contacts read that would populate it is Activity/
  permission-layer work not exercised by this environment's lack of a
  device. Manual entry (`ContactsViewModel.addManual`) is fully implemented
  and tested — ONB-03's "identical capabilities on denial" acceptance
  criterion is satisfiable today via the manual path; the import affordance
  itself needs on-device follow-up.
- **Radial canvas for calibration** — v0 uses a select-then-tap-ring-button
  list interaction instead of the true drag/radial `Canvas` composable;
  matches the RN reference's own stated v0 scope (full radial interaction is
  FS-02/Wave 2 per `rn-audit-map.md`), not a new gap introduced here.
- **Graphic charter ("Nuit") design tokens** — `ui/theme/Theme.kt` is a
  placeholder Material 3 color scheme; the real charter lands with the
  design specialist's work and was out of this agent's scope.
- **App icon** — placeholder vector/adaptive icon (`ic_launcher_*.xml`),
  not final branding.

### Gradle bootstrap (for the next agent / CI)

No `gradle` binary was on `PATH` in this environment, but a Gradle 8.13
distribution was already cached under
`~/.gradle/wrapper/dists/gradle-8.13-bin/.../gradle-8.13/bin/gradle` from
prior work on this machine. Bootstrap sequence used:

```
mkdir -p apps/android && cd apps/android
# settings.gradle.kts / build.gradle.kts / gradle.properties written first
~/.gradle/wrapper/dists/gradle-8.13-bin/*/gradle-8.13/bin/gradle wrapper --gradle-version 8.13
# generates gradle/wrapper/gradle-wrapper.{jar,properties} and gradlew(.bat)
./gradlew test   # now works standalone, re-downloading nothing (cache hit)
```

If no cached distribution exists in a fresh environment, `gradle wrapper`
needs network access to `services.gradle.org` once to fetch the pinned
Gradle version — confirmed reachable in this environment
(`https://services.gradle.org/distributions/...` returned a 307 redirect,
not a connection failure).

`local.properties` (`sdk.dir=/Users/mikedown/Library/Android/sdk`) is
machine-local and excluded via `apps/android/.gitignore`, along with
`build/`, `.gradle/`, `.kotlin/`.

### Wave-1 parity checklist (`docs/migration/rn-audit-map.md` — Android column, not edited directly per instructions; reported here for the lead to transcribe)

| Criterion | Status |
|---|---|
| Crypto vectors reproduced exactly | ✅ `VaultCryptoVectorTest` (decrypt, encrypt-with-fixed-IV byte-for-byte match, random-IV round-trip, random-IV uniqueness) |
| Phone-hash vectors reproduced exactly | ✅ `PhoneHashVectorTest` |
| Vault encrypted at rest; key in OS keystore; fresh-copy accessors (VLT-01) | 🟡 Fresh-copy accessors tested (`VaultTest`); Keystore-backed storage implemented (`AndroidKeystoreVaultKeyStore`) but unverified on-device |
| Sync: push, 409 → re-pull + retry once (VLT-02) | ✅ `VaultSyncTest` (success, 409-then-success, persistent-conflict-throws) |
| API client sends only phoneHash/code/displayName/{blob,version} (ONB-05) | ✅ `ApiClientTest` + `VaultSyncTest` assert request bodies by construction and by string content |
| Onboarding flow welcome→phone→otp→contacts→calibrate→done, French copy verbatim | 🟡 Implemented (state machine + view models + Compose screens); Compose screens unverified on-device (no emulator) |
| Resume-at-step after process kill (ONB-08); step stays phone until OTP verified | ✅ `OnboardingStateStoreTest`, `SignupViewModelTest` (pending hash cleared only after successful verify) |
| Contacts denied → manual entry, identical capabilities (ONB-03) | 🟡 Manual path implemented + tested; device import is a stub (deferred above) |
| État/ressenti layer optional + collapsed (ONB-06); no gamification (ONB-09) | ✅ `CalibrateScreen` defaults `optionalOpen = false`; `NoGamificationCopyTest` scans all copy |
| Airplane-mode: calibration persists locally, syncs later, only POST /vault carries derived data | ✅ `VaultTest` (persist without network), `VaultSyncTest` (body content assertion) — no on-device airplane-mode manual test performed |
