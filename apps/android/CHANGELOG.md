# apps/android — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

## 2026-08-09 — [SUG-AND-015, ONB-02, ONB-03] Phone/OTP/name inputs get the right keyboard type

- `InputField` (Primitives.kt) gains an optional `keyboardOptions` parameter (default `KeyboardOptions.Default`, so untouched call sites are unaffected).
- Phone field -> `KeyboardType.Phone`; OTP code -> `KeyboardType.Number`; display name + manual contact name -> `KeyboardCapitalization.Words`.
- `contentDescription = placeholder` deliberately left in place — the whole E2E suite locates fields by it; removing it is a separate mechanical `testTag` migration, noted as a follow-up rather than mixed in here.
- Dropped: SMS-OTP autofill content-type hints (`Modifier.semantics { contentType = ... }`) — `androidx.compose.ui.autofill.ContentType` is `internal` in this project's pinned compose-bom 2024.09.00 (confirmed by an actual compile failure, not guessed). Flagged as a follow-up for the next bom bump rather than forcing one now with no emulator available to verify end-to-end.
- Verified: `./gradlew test` + `compileDebugAndroidTestKotlin` green. Keyboard type isn't independently assertable via `SemanticsProperties` on this compose-ui-test version, so this is a `manual`/visual check on-device — existing contentDescription-based E2E selectors are unaffected (regression-covered by the full suite).

## 2026-08-09 — [SUG-AND-005, ONB-03, IDT-01, IDT-06] Wire « Importer mes contacts » — was a no-op button

- `MainActivity.kt`: `onImportContacts` was an empty lambda; now registers `ActivityResultContracts.RequestPermission()` (READ_CONTACTS) + `ActivityResultContracts.PickContact()` launchers on the Contacts `composable {}` — permission requested only right before launching the picker (genuinely used now, not held ambiently), denial sets `deniedVisible = true`.
- New `onboarding/DeviceContactReader.kt`: Android-only glue reading `DISPLAY_NAME` + first `Phone.NUMBER` off the picker's content URI. No hashing here — stays in `ContactsViewModel.addFromDevice` (IDT-01), so the raw number only exists transiently in the launcher callback + this function's return value, never in a StateFlow/log/vault field.
- `ContactsScreen` gains `deniedVisible: Boolean = false`, rendering `Fr.CONTACTS_DENIED` (previously defined but never rendered anywhere).
- New `ContactsScreenTest` (instrumented, standalone `createComposeRule` — no full Activity/permission dialog needed): denial copy shows/hides correctly.
- Deviation from the suggestion's literal plan: did not add a `ContactsViewModel.importFromUri` wrapper — `DeviceContactReader.read()` + the existing `addFromDevice()` already compose cleanly at the Activity call site, keeping the ViewModel free of `ContentResolver`/`Uri` Android types (existing JVM-testable convention). `ContactsViewModelTest`'s existing `addFromDevice` coverage is what exercises the hashing.
- `docs/qa/e2e-coverage.json`/`e2e-scenarios.md` ONB-03: honest reclassification — device import is wired now but the OS picker itself stays `manual` (system picker UI, no seeded device contacts in test env).
- Verified: `./gradlew test` green.

## 2026-08-09 — [SUG-AND-009, MAP-03, MAP-08] Fix node-initials contrast on état pastel backgrounds (~2:1 -> >=7:1)

- `EtatColors.EtatColor` gains an `onBackground` field; `etatColor()` returns the theme's existing dark-ink precedent (`#1c1505`, same value as `onPrimary` over the light étoile gold) for all 4 known états — ivory text on the mid-light état pastels was ~1.9:1, failing WCAG AA's 4.5:1 for 13sp text.
- `RadialMap.kt`'s `ContactNode`: initials text color now reads `palette.onBackground`, falling back to the theme's `onSurface` when unset (no état) — unchanged there.
- `EtatColors` stays Android/Compose-import-free (hex string, hardcoded rather than pulling in `DesignTokens` — see the code comment).
- New tests in `EtatColorsTest`: onBackground presence/null-fallback, plus a real WCAG relative-luminance contrast guard (`ratio >= 4.5`) locking the invariant against future palette edits.
- Flagged for design-agent ratification (node colors are packages/ui tokens SSOT territory) — not treated as final.
- Verified: `./gradlew test` green.

## 2026-08-09 — [SUG-AND-008, MAP-01, MAP-04, MAP-08] Map nodes now activatable by TalkBack; touch targets grow to 48dp

- `RadialMap.kt`'s `ContactNode`: replaced raw `pointerInput`+`detectTapGestures` (advertised `role = Button` but registered no OnClick semantics action — TalkBack double-tap silently did nothing) with `Modifier.clickable(...)`, which registers a real click action.
- Touch target grows to Material's 48dp floor (ring 4 nodes were 32dp) without changing the visual circle size: an outer Box owns size/click/semantics, an inner Box (visual circle, `testTag("carteNode-$ring-$index")`) stays at the true `MapGeometry.nodeSize`.
- New `test_MAP08_mapNode_hasClickActionForTalkBack`: `assertHasClickAction()` + `performClick()` opens the peek sheet.
- Updated `test_densityRegression_placedNodeSizeIsNotCollapsed` to measure the inner visual circle via its new testTag instead of the outer (now 48dp) semantics node, so the touch-target change doesn't trip the density guard.
- Verified: `./gradlew test` green.

## 2026-08-09 — [SUG-AND-017, ONB-04, ONB-06, FCH-01, FCH-06] État/ressenti/ring vocab lists de-duplicated into `carte.Vocab`

- New `carte/Vocab.kt`: `ETATS`/`RESSENTIS` defined once (JVM-testable, no Android imports, same convention as `EtatColors`/`Labels`) — previously copy-pasted verbatim across `CalibrateScreen.kt` and `FicheScreen.kt` with a "don't let them diverge" comment. These strings key `EtatColors.ETAT_COLORS`, `FicheFilterConsequence.forValue`, and the vault contents itself, so a silent divergence here would have been hard to migrate later.
- `CalibrateScreen.kt`'s `RING_LABELS` now points at `carte.Labels.RING_LABEL` (FicheScreen already imported it correctly).
- New `VocabTest`: locks the shared lists' content against `EtatColors.ETAT_COLORS.keys` and the shipped value counts.
- Pure de-duplication — rendering is byte-identical (French copy unchanged), verified by the unchanged copy-driven E2E suite.
- Verified: `./gradlew test` green.

## 2026-08-09 — [SUG-AND-014, ONB-04, ONB-05, ONB-06] Calibration screen gains the radial canvas — was a text list only

- New `ui/carte/RingCanvas.kt`: `RingsAndSpokes`/`MeNode` extracted out of `RadialMap.kt` (now `internal`, cross-package within the module) so carte and calibrate share one spatial truth; `MeNode` takes a `label` param (was hardcoded `Fr.CARTE_ME`) so calibrate can pass `Fr.CALIBRATE_ME` without the two screens silently diverging.
- New `MapGeometry.ringForDistance(radius): Int?` — annulus hit-testing (nearest ring, rejects the center/off-canvas) for tap-to-place on the canvas.
- New `ui/onboarding/CalibrateRadial.kt`: the 320dp canvas — placed contacts as ring nodes (no état color/animation, unlike carte's `ContactNode` — this canvas is static), unplaced contacts in a tray below. Nodes use `clickable` (not raw `pointerInput`) from the start, so they don't carry the TalkBack bug SUG-AND-008 fixes on carte.
- `CalibrateScreen.kt`: canvas renders by default (ONB-04 "visually prefigures the map"); the full text roster + per-ring buttons stay underneath, unconditionally — same `select`/`placeSelectedOnRing` calls either affordance uses, so the existing copy-driven E2E flow (`E2EFlows.kt`) needed zero changes. `Fr.CALIBRATE_LIST_MODE` (previously unused) now toggles the canvas off for a leaner TalkBack-only screen.
- New tests: `MapGeometryTest` ringForDistance cases; `OnboardingE2ETest.test_ONB04_radialCanvas_showsMoiAndRingsOnCalibrate`.
- Not done: on-device screenshot pair for the "visually prefigures the map" acceptance criterion — no booted emulator available while writing this; verify visually before considering ONB-04 fully closed.
- Verified: `./gradlew test` green; `scripts/e2e-android.sh` to run after all SUG-AND items land this session (see session summary).

## 2026-08-09 — [SUG-AND-002, ONB-04, ONB-05, FCH-01] Fix rings 3/4 unreachable: chip Rows overflow on long French labels

- `CalibrateScreen.kt`: ring-selection `Row` (4 long labels, e.g. « Anneau 3 — Familier ») replaced with a full-width `Column` — closes the documented production bug where rings 3/4 were unreachable during onboarding. Same treatment applied to the État/Ressenti rows (État now has 4 values since OQ-FCH-2).
- `FicheScreen.kt`: wrapped the 4 axis chip `Row`s (Intimité/Rôles/État/Ressenti) in `Modifier.horizontalScroll(rememberScrollState())` so they don't clip on narrow screens or large font scale.
- `E2EFlows.kt`: removed the `require(ring == 1 || ring == 2)` test-only guard; `completeOnboarding` now drives all 4 rings.
- New `OnboardingE2ETest.test_ONB04_allFourRingsPlaceable`: calibrates 4 contacts, one per ring.
- No French copy changed (labels are byte-identical, only layout).
- Verified: `./gradlew test` green (JVM). `scripts/e2e-android.sh` to be run after all 9 SUG-AND items land (see session summary).

## 2026-08-09 — [SUG-AND-003, ONB-02, ONB-08, MAP-02] ViewModel lifecycle: `viewModel()` scoping + single onboarding-step source of truth

- `MainActivity.kt`: `ContactsViewModel`/`CalibrateViewModel` were plain-constructed per recomposition (fresh vault read + `CalibrateViewModel`'s selection silently reset every recomposition) — now `viewModel { … }`, scoped to their `NavBackStackEntry`. `OnboardingViewModel`/`SignupViewModel`/`CarteViewModel` used `remember {}` (no config-change survival: rotation lost `PendingSignup.pendingPhoneHash` mid-OTP) — now `viewModel { … }`, Activity-ViewModelStore-scoped (`SwabNavHost` is called directly from `setContent`). `FicheViewModel` moved from `remember(contactId)` to `viewModel(key = contactId) { … }`.
- Deleted the now-redundant `rememberSignupViewModel` helper and the resulting unused `remember` import.
- Contacts/Calibrate/Done screens wrote `onboardingStateStore.setStep(...)` directly, bypassing `OnboardingViewModel._step` — left `step` stale at PHONE for any future reader. All three now route through `onboardingViewModel.advanceTo(...)`.
- New tests: `OnboardingViewModelTest.test_ONB08_advanceTo_keepsStepFlowInSyncWithStore` (JVM), `ActivityRecreationSmokeTest.test_ONB02_recreateAtOtp_pendingPhoneHashSurvives` (instrumented — rotates on the OTP screen, asserts the dev code/pending hash survive instead of falling back to `Fr.OTP_MISSING_PHONE`).
- Verified: `./gradlew test` (120 JVM tests debug + 120 release, 0 failures) + `scripts/e2e-android.sh` full connected suite (20/20 passing, report PASS, zero drift-guard failures) on a Pixel_6_Pro/API-34 emulator — the Pixel_8_Pro AVD in this environment images API 37 and its Espresso build can't run at all (`InputManager.getInstance` reflection removed), unrelated to this change; used Pixel_6_Pro instead.
- Gotcha (flagged, not hand-verified live): Contacts/Calibrate VMs now survive while their `NavBackStackEntry` stays on the backstack. Re-entering Calibrate unselected after popping back and forward again relies on Navigation-Compose's documented guarantee (a popped entry's `ViewModelStore` is cleared, so pushing a *new* Calibrate entry gets a fresh `CalibrateViewModel`) — not independently exercised on-device, since onboarding wires no back affordance from Calibrate to Contacts (only the unhandled system back gesture reaches that path).

## 2026-08-09 — [SUG-DES-004] Typography + Shapes now consumed from DesignTokens; Inter/Space Grotesk bundled

- Bundled Inter (400/500/600) + Space Grotesk (400/500/600) as `res/font/*.ttf` — real OFL 1.1-licensed static instances fetched from Google Fonts' CDN (`google/fonts` ofl/inter, ofl/spacegrotesk sources), never invented/stubbed. License text + attribution: `app/src/main/assets/font-licenses/` (`OFL-Inter.txt`, `OFL-SpaceGrotesk.txt`, `NOTICE.md`). No network font fetches at runtime.
- New `ui/theme/Typography.kt`: builds `androidx.compose.material3.Typography` from `DesignTokens.Typography` — `titleLarge`<-TITLE, `bodyLarge`<-BASE, `labelLarge`<-BUTTON, `bodyMedium`<-SUBTITLE, `labelSmall`<-LABEL. `lineHeight` (unitless multiplier token) converted as `size * lineHeight` sp; `letterSpacingEm` via the `.em` TextUnit extension (not `.sp` — keeps SUG-DES-012's Dynamic-Type contract, sizes stay in `.sp` throughout). `textTransform: uppercase` (LABEL) is a no-op here — Compose has no textTransform, applied at call sites (none exist yet).
- New `ui/theme/Shapes.kt`: `Shapes` from `DesignTokens.Radius` — small=INPUT(10), medium=CARD(12), large=TILE(14). `Theme.kt` now passes both into `MaterialTheme` alongside `SwabNuit`.
- New tests: `SwabTypographyTest` (7 cases incl. the suggestion's named `bodyLarge.fontSize == BASE.size.sp` check, plus lineHeight/letterSpacing), `SwabShapesTest` (3 cases). Both plain-JVM (no emulator needed, same convention as `DesignTokens.kt`/`EtatColors.kt`).
- Verified: `./gradlew test` and `./gradlew assembleDebug` both BUILD SUCCESSFUL (confirms fonts package correctly into a real APK).

## 2026-08-09 — [SUG-DES-011] Minimum touch targets on Fiche axis chips + Carte list-mode switch

- Applied `Modifier.minimumInteractiveComponentSize()` (Material3 built-in, 48dp floor) to the Fiche axis `FilterChip`s — Intimité (segmented/intimacy-cell equivalent), Rôles, État, Ressenti (`FicheScreen.kt`) — and the Carte list-mode `Switch` (`CarteScreen.kt`). Visual geometry is untouched; only the tappable region grows, per the suggestion's "hit-area-only" rule.
- No dedicated "Tag"/"Segmented" composable files exist in this codebase yet (only Material3 `FilterChip` calls) — mapped onto them per suggestions/design/SUG-DES-011.
- Added `FicheTouchTargetsTest` (androidTest, instrumented) locking touch bounds >=48dp on all three. **Flagged, not silently substituted:** `assertTouchHeightIsAtLeast` (named in the suggestion's acceptance criteria) doesn't exist in this project's pinned Compose Test version (compose-bom 2024.09.00 -> ui-test 1.7.0, confirmed by decompiling `BoundsAssertionsKt`); used `assertTouchHeightIsEqualTo(48.dp)` instead, which is equivalent here since `minimumInteractiveComponentSize()` pads exactly to 48dp when the visual size is smaller. Did not bump compose-bom to chase one helper — no emulator in this environment to verify a wide-blast-radius bump end-to-end.
- Test requires a booted emulator (`scripts/e2e-android.sh`) to actually run — not exercised by `./gradlew test` here, consistent with this repo's existing instrumented-test constraint (no emulator in this sandbox).
- `./gradlew test` + `compileDebugAndroidTestKotlin`: BUILD SUCCESSFUL.

## 2026-08-09 — [MAP-03, SUG-DES-006] État palette repointed to token SSOT

- `EtatColors.kt`'s 3 blueprint-sourced hex literals (disponible/occupé/ailleurs) now read from `DesignTokens.Color.ETAT_DISPONIBLE/ETAT_OCCUPE/ETAT_AILLEURS` (generated from `tokens.json`, landed on `main` by design-specialist in `9070165`). Pure indirection: tokens store lowercase hex, `.uppercase()`'d at the call site so the map's values stay byte-identical to the prior literals.
- `en pause` → `#A69CB0` stays hardcoded (not blueprint-sourced, not in the token SSOT — out of SUG-DES-006's scope).
- `Fr.t(...)` keying and null/fallback behavior (`etatColor(null)`, unknown état) untouched. `EtatColorsTest` passes with **zero test edits** — proves the refactor is value-neutral.
- `grep -rn "8FB59A\|C8917E\|8AA0BE" app/src/main` now matches nothing (only the test file's expected-value literals remain, by design).
- Verified: `./gradlew test` BUILD SUCCESSFUL, all JVM unit tests green (debug+release).

## 2026-08-09 — [FCH-01, OQ-FCH-1] Real Rôles·contexte and Ressenti vocabularies

- Architect decision (issue #15, FS-03): replaced the invented placeholder vocabularies with the real ones extracted verbatim from the blueprint (`blueprints/swab - Fiche contact (standalone) (1).html`, embedded `ROLES`/`VALENCES` consts). **Rôles·contexte** is now a 6-value multi-select: `famille, partenaire, collègue, promo, communauté, voisin` (lowercase, matching blueprint casing and the État/Ressenti copy style). **Ressenti** is a full 3-value swap: `positive, ambivalente, négative`, replacing `léger`/`précieux` entirely.
- `Fr.kt`: removed `FICHE_ROLE_FAMILLE/AMITIE/TRAVAIL/VOISINAGE/AUTRE` and `RESSENTI_LIGHT/PRECIOUS`; added `ROLE_FAMILLE/PARTENAIRE/COLLEGUE/PROMO/COMMUNAUTE/VOISIN` and `RESSENTI_POSITIVE/AMBIVALENT/NEGATIVE`. `ALL_STRINGS` updated to match (feeds `NoGamificationCopyTest`, unaffected by the new values).
- `FicheScreen.kt`'s `ROLES`/`RESSENTIS` and `CalibrateScreen.kt`'s `RESSENTIS` arrays updated to the new constants. État is untouched (still 4 values, per #16).
- Tests updated to lock the new vocab: `FicheFilterConsequenceTest` (asserts null across all 3 new Ressenti values), `FicheE2ETest` (drives `positive` instead of `léger`), `FicheViewModelTest`/`FichePrivacyLeakTest` (literal ressenti test values swapped to `positive`/`négative`). No real users existed yet, so this is a vocabulary swap, not a data migration.
- Full `./gradlew test --rerun-tasks`: BUILD SUCCESSFUL, all JVM unit tests green (debug+release).
- Mirrors the equivalent iOS fix (`apps/ios/CHANGELOG.md`) — kept conceptually aligned, Kotlin-idiomatic in structure.

## 2026-08-09 — [FCH-06, OQ-FCH-2] `en pause` moves from Ressenti to État

- Architect decision (issue #16, FS-03): `en pause` is canonically an ÉTAT value. Moved `Fr.RESSENTI_PAUSED` → `Fr.ETAT_PAUSED`; État now ships 4 values (disponible/occupé/ailleurs/en pause), Ressenti drops to 2 (léger/précieux — still placeholder per OQ-FCH-1).
- `EtatColors.kt`: added `en pause` → `#A69CB0` (new dusty-lavender, not blueprint-sourced like the other 3 — chosen to match their muted/desaturated style; Ressenti never had its own color map so nothing to remove there).
- `FicheFilterConsequence.kt`: removed the dual-axis (`etat`/`ressenti`) workaround; now checks état only. `FicheScreen.kt`/`CalibrateScreen.kt`'s private `ETATS`/`RESSENTIS` arrays updated to match; stale "ships under ressenti" comment removed from `FicheScreen.kt`.
- Updated tests to lock the new assignment: `FicheFilterConsequenceTest`, `EtatColorsTest` (new 4th-color case), `FichePrivacyLeakTest` (exercises `en pause` on État, a real Ressenti value on Ressenti). Full `./gradlew test`: 109/109 green (debug+release).
- Mirrors the equivalent iOS fix (`apps/ios/CHANGELOG.md`) — kept conceptually aligned, Kotlin-idiomatic in structure.

## 2026-07-19 — [design-system] Wire real Nuit tokens into Theme.kt, retire placeholder

- `Theme.kt`'s Wave-1 placeholder (`darkColorScheme`/`lightColorScheme` pair with invented `SwabLight` hex values) is replaced by a single `darkColorScheme` built from the now-generated `DesignTokens.kt`. `docs/design-system.md` §1 is explicit: Nuit is **one** dark theme, no light palette exists anywhere in the charter/Penpot/`tokens.json` — inventing one would violate the design agent's no-invented-values rule, so `isSystemInDarkTheme()` branching is removed; the app always renders Nuit regardless of OS setting. This is a behavior change, not just a color fill-in — flagging per instructions.
- Role mapping follows `docs/design-system.md` §1 role descriptions, not Material3's default names: `background`=nuit, `surface`=encre, `surfaceVariant`=voile, `surfaceContainerHighest`=voile-2, `onBackground`/`onSurface`=ivoire, `onSurfaceVariant`=brume, `outline`=hair-fort (opacity-composited), `outlineVariant`=hair, `primary`=étoile, `onPrimary`=étoile-encre.
- Deliberately left at Material3 defaults (no charter basis, not invented): `tertiary*`, `secondary*`, `inverse*`, `scrim`, `surfaceDim`/`surfaceBright`/other `surfaceContainer*` steps. `error*` roles also left default — `corail` is documented as "never an error red" (caution/en-retrait, not form-validation error), so mapping it to M3's `error` slot would misuse the token; no app code currently reads `isError`/`error*`, confirmed by grep.
- Verified: `./gradlew test` 216/216 JVM tests green (debug+release), `./gradlew :app:compileDebugKotlin` clean. Grepped `apps/android` for other hardcoded hex duplicating `DesignTokens` — none found beyond the already-flagged `EtatColors.kt` 3-état divergence (untouched, out of scope).

## 2026-07-11 — [ONB-01..09, MAP-01/02/04/06/08/09, FCH-01..08, VLT-01] Wave 4 — Compose E2E suite (16/16) + legacy-vault seed hook

- New `app/src/androidTest/.../e2e/`: 14 instrumented Compose UI tests (5 classes + shared `E2EFlows.kt`) driving the real app against the live `docker compose` API (`10.0.2.2:3001`) — onboarding happy path with runtime no-gamification semantics scans, map/peek-sheet/list-mode, fiche axis-edit persistence + newest-first history, legacy-vault backward compat, Activity-recreation smoke. Plus dedicated regression tests for the Wave-1 nav state-loss bug and the Wave-2 density bug (measures rendered node pixels vs `MapGeometry.nodeSize × density`).
- Legacy-vault seeding via `E2ESeedHooks`, selected at **compile time** by build variant (debug = real implementation behind an opt-in Intent extra, writing an old-shape blob through the real Keystore/crypto path; release = no-op source file — seeding code physically absent from release APKs, verified by disassembly). Test Orchestrator enabled so each `@Test` gets a fresh process/state.
- Final run from clean: `./gradlew :app:clean :app:connectedDebugAndroidTest` on a booted Pixel_6_Pro (API 34) → **16/16 passed** (14 new + 2 pre-existing Keystore regression tests); release compile green.
- One stale test assumption found and fixed (not an app bug): Carte's `LaunchedEffect` *does* refresh on return from Fiche, so the map label already shows the post-edit ring.
- **Gotchas:** never run two instrumentation sessions against one device (corrupts both — reads as `Process crashed`/`0 tests`). Each test needs a unique phone number (per-hash OTP throttle, 3/5min). `waitUntilSelected` must read the **merged** semantics tree (`Selected` lives on `FilterChip`'s parent). Calibration flows assert-fail on rings 3/4 so the open `CalibrateScreen` text-wrap bug can't be silently skirted.
- **Deliberately not automated:** MAP-05/07 perf (needs Macrobenchmark on hardware), MAP-03/04 visual qualities, FCH-05 staleness (needs time travel — JVM-covered instead), FCH-04 match events (no FS-04/05 source yet), ONB-03 device import (unwired), celebration *animations* (none exist to catch).

## 2026-07-10 — [FCH-01..08] FS-03 Contact Card (Wave 3) — greenfield fiche screen, vault history + staleness

- No RN reference existed — built from `docs/specs/FS-03-contact-card.md`. `Vault.kt` extended (all inside the encrypted blob): `targetId: String?` (null for every contact today — discovery has no client yet, so FCH-08 pending state is honest), `lastAxisChangeAt`/`staleSnoozedUntil`, `history` + `recordAxisEdit` (atomic single-lock append), `setRoles`, confirm/snooze. Pure `fiche/FicheStaleness.kt` (6-month ⚠️ ASSUMPTION, 30-day snooze) + `FicheFilterConsequence.kt`; `FicheViewModel` (vault-only, structurally network-free); `FicheScreen` (four tap-editable axes, newest-first history, inline Card nudge — never an AlertDialog; pending contacts stay fully editable). New `fiche/{contactId}` leaf route; FCH-07 (back preserves map position) falls out of Navigation-Compose composition retention for free.
- **Deviations, reasoned:** no reciprocity signal rendered at all (FCH-03 optional; anything shown risks implying visibility of the other side's classification — FCH-02). FCH-04 match events deferred (no FS-05 data source; `axis = null` reserved). `en pause` checked on both état AND ressenti (shipped-3-état vs blueprint divergence, rn-native-handoff §5 — flagged, not resolved). Rôles taxonomy is OQ-FCH-1's placeholder, marked ⚠️.
- Tests: **108/108 JVM**, jacoco domain coverage 98.32% (new `fiche` package 100%). `FichePrivacyLeakTest` drives all four axis edits through the real ViewModel→Vault→VaultSync→ApiClient path with a recording transport and asserts zero plaintext values/labels/field names in the literal request body.

## 2026-07-10 — [MAP-01..09] FS-02 Relationship Map (Wave 2) — radial carte, list fallback, 3-tab nav

- 1:1 port of the RN map: pure `carte/` package (`MapGeometry` golden-angle placement, `EtatColors` — 3-état set with the 5-état blueprint divergence carried forward flagged, `Labels`, `CarteViewModel` vault-only) + Compose `ui/carte/` (rings/spokes in one `Canvas`, per-contact composables for semantics/gestures, pinch 1x–3x + bounded pan, first-mount snap vs animated re-tag, `ModalBottomSheet` peek with disabled FS-03 seam, ring-grouped `RingList`, calm empty state) + 3-tab `BottomNav` (label-only API — badges impossible by construction, enforced by `BottomNavStructuralTest`). `CarteViewModel` hoisted to `SwabNavHost` scope (sibling-tab survival).
- **Real bug found via the live walkthrough (invisible to JVM tests): `Float.toDp()` double-conversion.** `MapGeometry` units are dp-equivalent; `toDp()` divides by density, collapsing the map ~3.5× on a Pixel_6_Pro. Fix: `.dp` directly outside `Canvas`; multiply by `density` inside `DrawScope` and for pixel-space pan bounds. Verified with before/after screenshots.
- Tests: **80/80 JVM**, domain coverage 98.4% (`carte` 100%). Full on-device walkthrough (adb-driven, non-interactive) welcome → OTP (live API) → 2 manual contacts → calibrate → Carte: map/peek/list/nav all verified, zero logcat exceptions.
- **Deferred:** clustering (OQ-MAP-1), fiche navigation (seam only), Compose UI tests for `ui/carte` (landed in Wave 4), Perfetto perf run.

## 2026-07-10 — [VLT-01, IDT-01, ONB-02] On-device walkthrough: emulator base URL + a real Keystore bug

- Emulator can't reach host `localhost`: added `BuildConfig.API_BASE_URL` per build type (debug → `http://10.0.2.2:3001`) + a **debug-only** cleartext network-security config scoped to `10.0.2.2`/`localhost` (release untouched, G1).
- **Real bug fixed:** Android Keystore AES/GCM keys require randomized encryption — `Cipher.init(ENCRYPT_MODE, key, GCMParameterSpec(iv))` throws `Caller-provided IV not permitted`. Fix: init without a spec, read the Keystore-chosen IV back from `cipher.iv` (DECRYPT_MODE unaffected). Only reproduces against the real provider — regression-guarded by `AndroidKeystoreVaultKeyStoreTest` (instrumented).
- **Second bug fixed:** `rememberSignupViewModel` called inside each `composable {}` scoped the ViewModel per NavBackStackEntry, so Phone → OTP created a fresh instance and lost the phone hash. Hoisted one shared instance to `SwabNavHost` scope.
- Verified end-to-end against the live API: OTP request 200 → verify 422 `needsName` → verify-with-name 200 → Contacts screen; vault key creation no longer throws; 47/47 JVM + 2/2 instrumented green.

## 2026-07-10 — [VLT-01/02/04, IDT-01/02/06, ONB-01..09] Bootstrap apps/android, Wave 1 (FS-07 client + FS-01 onboarding)

- Created `apps/android` from scratch: Gradle Kotlin DSL, single `:app`, Compose + MVVM. Domain code is Android-import-free → plain JVM tests (no emulator/Robolectric). Crypto TDD, vectors first: `VaultCrypto` (`javax.crypto`, wire `base64(IV‖TAG‖CT)`), `PhoneHash`, contract tests against a **copy** of `vault-test-vectors.json` in test resources (keep in sync with `docs/migration/`). Vault (immutable copies, VLT-01), `AndroidKeystoreVaultKeyStore` (envelope encryption: non-exportable Keystore key wraps a portable 32-byte vault key — a raw key is required by the cross-platform vector contract), `VaultSync` (409 → re-pull → retry once → loud fail), `ApiClient` over `HttpURLConnection` (no OkHttp — G4; no Kotlin type for classification data exists, test-asserted), onboarding state machine + ViewModels (vault key created before any classification input, ONB-02; 422 `needsName` path), full verbatim French copy + `NoGamificationCopyTest` (ONB-09), Compose screens with start/end-only layout + semantics.
- Tests: **47/47 JVM**, domain coverage 98.1%.
- **Gotchas:** a KDoc comment containing a literal `/*` (e.g. a `ui/*` path) opens a nested Kotlin block comment that swallows the file. `Cipher.doFinal` returns `CT‖TAG` — reorder for the wire format (garbled-blob failures, not clean tag mismatches, if missed). `viewModelScope` needs a `MainDispatcherRule` on the JVM. Pins: Gradle 8.13 / AGP 8.5.2 / Kotlin 2.0.21 (Compose compiler via the Kotlin plugin) / BOM 2024.09.00; `compileSdk = 35` triggers a benign AGP warning.
- **Deferred (verified later in the waves above):** on-device verification of Keystore/DataStore/HTTP adapters and Compose screens, Compose UI tests, device contact import (manual-add path fully tested — ONB-03 holds), radial calibration canvas (v0 list interaction matches the RN reference's stated v0 scope), Nuit design tokens, final app icon.
