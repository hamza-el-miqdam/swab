# apps/ios — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

## 2026-08-09 — [VLT-01, ONB-04, FCH-01] `Vault` enforces its own 1...4 ring invariant (SUG-IOS-014)

- `Vault.setRing`/`setFicheRing` now throw new `VaultError.invalidRing(Int)` for any ring outside `VaultRing.range` (1...4, now spec-frozen per FS-01 ONB-04's 4-ring taxonomy) instead of persisting it silently — protects `MapGeometry`'s layout math (negative node sizes, nil ring labels) from a foreign/corrupt VLT-02-synced blob.
- Defensive decode: `VaultContact.init(from:)` normalizes an out-of-range `ring` to `nil` ("unplaced", visible in the MAP-09 tray) rather than propagating it — never rewrites storage eagerly, only affects a later legitimate persist.
- Existing UI call sites (`FicheViewModel.setRing`, `OnboardingViewModels` ring picker) already use `try?`; the throw is silently absorbed there since the UI only ever offers valid rings — acceptable per the suggestion, pairs with a future error-reporter seam.
- Tests: `test_VLT01_setRing_outOfRange_throwsInvalidRing`, `test_VLT01_decodeContactWithOutOfRangeRing_normalizesToUnplaced`, `test_FCH01_setFicheRing_outOfRange_throwsAndAppendsNoHistory`. `xcrun swift test`: 116/116.

## 2026-08-09 — [SUG-DES-004] Typography/Radius tokens consumed; Inter + Space Grotesk bundled

- Bundled Inter (400/500/600) + Space Grotesk (400/500/600) as OFL-licensed TTFs (`App/Resources/Fonts/`, source: `fonts.gstatic.com`, license text alongside), registered via `UIAppFonts` (`App/Info.plist`, merged into the auto-generated plist via `INFOPLIST_FILE` + `GENERATE_INFOPLIST_FILE=YES` since `UIAppFonts` is an array — no `INFOPLIST_KEY_*` covers that). No runtime network font fetches. Xcode project (`project.pbxproj`) hand-edited: new file refs, a `Resources` build-phase membership, and the `INFOPLIST_FILE` setting on both configs.
- **Gotcha found and fixed**: Google's static-instance export embeds *every* Space Grotesk weight under the internal family "Space Grotesk Light" (verified against the CDN directly, not a local bug) — `Font.custom("Space Grotesk", …)` would silently fall back to the system font. New `SwabUI/Components/Typography.swift` (`SwabTypeStyle`/`.swabType(...)`) resolves by PostScript name instead (`SpaceGroteskLight-Medium` etc.), computed from `DesignTokens.Typography`'s (family, weight). New `SwabUITests` test target (`Package.swift`) — `TypographyFontBundlingTests` reads each bundled `.ttf`'s real internal name via CoreGraphics and asserts it matches the mapping, so this class of bug fails loudly in CI.
- `.swabType(...)` applied across Onboarding/Carte/Fiche screens' `Text` styles (wordmark, title, doneTitle, subtitle, tag, caption — mapped from whatever SwiftUI style was already there, kept as the Dynamic-Type `relativeTo:` anchor). `DesignTokens.Radius.input` wired into `FicheView`'s staleness-nudge card corners.
- **Deliberately left unmapped**: `.largeTitle.weight(.semibold)` page headers (CarteView/FicheView/MainTabsView) — no SSOT token covers that size (wordmark tops out at 26pt); flagged inline rather than guessing a new design value.
- New XCUITest `test_SUGDES004_wordmarkScreenshot_forSpaceGroteskVisualAudit` attaches a wordmark screenshot for visual audit — not automated pixel-diffing (no golden-image infra yet); `TypographyFontBundlingTests` is the real regression guard.
- **Real regression found + fixed, root-caused not guessed**: registering the 6 fonts via `UIAppFonts` (regardless of whether any `Text` uses them — bisected with `.swabType()` fully reverted, still reproduced) makes `test_backgroundForeground_onCarte_doesNotCrash` fail: an immediate `app.state` read right after `app.activate()` sometimes still reports `.runningBackground`, because scene reactivation now does real extra CoreText work re-validating the bundled fonts. Confirmed NOT a crash (no crash log; toggling `UIAppFonts` on/off with everything else constant reproduces/fixes it deterministically). Fixed the test itself to wait for the Carte element before reading `app.state` — matching the sibling test's own already-documented pattern above it, which this one had silently violated (a preexisting, latent test fragility this work exposed, not introduced).
- `xcrun swift test`: 113/113. Full `xcodebuild test` (Simulator + local API): 15/15.

## 2026-08-09 — [SUG-DES-011] Minimum touch target for Tag/Segmented wrapper views

- New `MinTouchTarget` modifier (`SwabUI/Components/TouchTarget.swift`) — `.minTouchTarget()` extends a view's tappable region to `DesignTokens.Component.Touch.minTarget` (44pt) via `.frame(minWidth:minHeight:)` + `.contentShape(Rectangle())`, applied AFTER visual padding/background so drawn geometry is unchanged (charter-normative, per `docs/design-system.md` §3).
- Adopted on the four sub-44pt interactive wrappers: `FicheView.axisChip` (état/ressenti/intimité tags, ≈30-32pt), `FlowRolesView` (rôles tags), `CarteView.unplacedTray` (unplaced-contact tags), `CalibrateView.ringButtons` (the intimacy-level selector — this app's segmented-control analog, `.lvl`/`.segb` in the prototype). Native `Toggle` (switch) rows left untouched — the system control already meets the 44pt minimum by itself.
- New XCUITest `test_SUGDES011_tagTouchTarget_tapOutsideVisualEdgeStillSelects` (`MapAndFicheE2ETests.swift`): taps ~3pt inside the widened frame's top edge — above where the ≈30-32pt visual capsule would start — and asserts the ring chip still selects.
- **Bundled fix** (unrelated pre-existing regression, needed to get the XCUITest target building at all): `test_FCH08_...` still referenced `Fr.ressentiPrecious`, renamed to `.ressentiPositive` by `c65202b` (OQ-FCH-1) — missed because the XCUITest target lives outside `Package.swift`'s glob, so `xcrun swift test` never caught it.
- `xcrun swift test`: 111/111. `xcodebuild test -only-testing:SwabAppUITests/MapAndFicheE2ETests`: 8/8 (live Simulator + local API).

## 2026-08-09 — [MAP-03, SUG-DES-006] EtatColors repointed to the token SSOT

- `EtatColors.available`/`.busy`/`.away` now derive from `DesignTokens.Color.etatDisponible`/`.etatOccupe`/`.etatAilleurs` (generated from `packages/ui/tokens/tokens.json` by the design-specialist's `9070165`) instead of hardcoded hex literals — the design persona flagged the duplication as a defect (SUG-DES-006).
- Pure indirection: `.uppercased()` normalizes the token's lowercase hex to match this file's existing casing convention; values are byte-identical. `Fr.t(...)` keying, `byLabel`, and nil/unrecognized fallback (`EtatColors.swift:34-39`) untouched.
- `paused` (`#9A8FB5`, OQ-FCH-2) stays hardcoded — not in the SSOT yet, out of scope for this suggestion.
- `EtatColorsTests` untouched — zero edits, still asserts literal `"#8FB59A"` etc. and passes — proves the refactor is value-neutral. Full `xcrun swift test`: 111/111.

## 2026-08-09 — [FCH-01, OQ-FCH-1] Rôles·contexte and Ressenti replaced with real blueprint vocabulary (issue #15)

- Architect decision (issue #15) resolves OQ-FCH-1: invented placeholders swapped for the blueprint's real `ROLES`/`VALENCES` consts (`blueprints/swab - Fiche contact (standalone) (1).html`). Rôles·contexte is now a 6-value multi-select — famille, partenaire, collègue, promo, communauté, voisin — newly routed through `Fr`/`I18nKey` (previously raw strings, unlike the other three axes). Ressenti is a full 3-value swap — positive, ambivalente, négative — replacing léger/précieux entirely, not an addition.
- `Fr.swift`: added 6 `role.*` keys + 3 `ressenti.*` keys; removed `.ressentiLight`/`.ressentiPrecious` entirely (breaking rename, no back-compat alias — no shipped users to migrate).
- `FicheVocabulary.roles`/`.ressentis` now built from `Fr.t(...)`; doc comment rewritten to cite the blueprint source instead of flagging OQ-FCH-1 as open. `CalibrateView`'s private `ressentis` array updated to match (roles are not calibrated at onboarding, so no change needed there).
- État untouched by this change (separate divergence, `rn-native-handoff.md` §5) — still 4 values from the #16 fix.
- Tests rewritten to lock in the new vocabularies (not just made to pass): `FicheVocabularyTests`, `FicheFilterConsequenceTests` (key rename), plus opaque passthrough string literals updated in `FicheVaultTests`/`VaultTests`/`FichePrivacyInvariantTests` (index-based, no changes needed there beyond literals). Full `xcrun swift test`: 111/111.

## 2026-08-09 — [FCH-06, OQ-FCH-2] "en pause" moved from Ressenti to État (issue #16)

- Architect decision (issue #16) resolves OQ-FCH-2: `en pause` is an ÉTAT value, not Ressenti. `Fr.etatPaused` replaces `Fr.ressentiPaused` (copy unchanged, axis changed); `FicheVocabulary.etats` now has 4 values, `.ressentis` 2 (léger, précieux — OQ-FCH-1 still open on Ressenti's final vocabulary).
- `EtatColors.byLabel` gains a 4th color `#9A8FB5` (muted violet-grey, no prior value existed to reuse) — its own separate 5-état blueprint-divergence comment is untouched.
- `FicheFilterConsequence` simplified to check `etat` only; removed the dual-axis workaround and its divergence-flag comment. `CalibrateView`'s private `etats`/`ressentis` arrays updated to match, per `FicheVocabulary`'s sync note.
- Tests updated to lock in the new axis (not just made to pass): `EtatColorsTests`, `FicheVocabularyTests`, `FicheFilterConsequenceTests`, `FichePrivacyInvariantTests` (array-index fixups). Full `xcrun swift test`: 111/111.

## 2026-07-19 — CarteTheme sourced from the canonical design-token SSOT, not the stale RN palette

- `CarteTheme` hardcoded a brown/gold palette ported from the long-deleted `apps/mobile/src/theme.ts` (`bg #16120D`, `accent #D9A441`) that never matched the real Nuit graphic charter (`docs/design-system.md`). Now every property is repointed to `DesignTokens.Color.*` (the generated SSOT from `packages/ui/tokens/tokens.json`): `bg→nuit`, `surface→voile`, `text→ivoire`, `textDim→brume`, `accent→etoile`, `accentInk→étoile-encre`.
- `line`/`ringLine` map to `hair`/`hair-fort`, which are opacity-bearing tokens (rgba, not solid hex) — since `CarteTheme`'s contract is a single hex `String` with no separate opacity channel, alpha is baked into an 8-digit RRGGBBAA hex via a small private helper. `ringLine` uses `hair-fort` (not `hair`): the radial map's distance-ring circles/spokes need more contrast than a plain hairline to stay legible, matching the old palette's own ringLine-brighter-than-line pattern.
- Public API shape unchanged (same property names/types), so `ColorHex.swift` and `EtatColors.swift` needed no changes. `EtatColorsTests` (6/6) already asserted symbolically against `CarteTheme.surface`/`.line`, not literal hex — passed unchanged. Full `xcrun swift test`: 110/110.
- `EtatColors`'s own état palette (`available`/`busy`/`away`) is a separate, intentionally-flagged divergence (see its own comment) — not touched.

## 2026-07-12 — [ONB-01..09, MAP-02/04/06/08, FCH-01/04/07/08, VLT-01] Wave 4 — XCUITest E2E suite green (13/13), code-signing root cause fixed

- New `SwabAppUITests` XCUITest target: 13 tests across `OnboardingE2ETests`, `MapAndFicheE2ETests`, `RegressionAndResilienceE2ETests`, driven on a booted "iPhone 17" Simulator against the live `docker compose up` API. Final run: `xcodebuild test` → **13/13 passed, 0 failures** (~290s).
- **Root cause of the initial 11-failure run:** `project.pbxproj` had `CODE_SIGNING_ALLOWED = NO` on all six build configs (a stale Wave-1 default from before any app-process Keychain use). A fully unsigned process has no entitlements, so `ApiClient`'s unconditional Keychain read (`session.getAccessToken()`) threw `errSecMissingEntitlement (-34018)` before any network call — the app stalled on the phone screen's error state. Diagnosed via `.xcresult` accessibility snapshots + `simctl log stream`, not guessed.
- **Fix:** ad hoc signing (`CODE_SIGN_IDENTITY = "-"`, `CODE_SIGNING_ALLOWED/REQUIRED = YES`, Simulator-only, no team needed) across all six configs. Verified stale-default (not a CI/security boundary) via `git log` before changing.
- **Gotcha:** bare `xcrun swift test` CLI processes can use the Keychain unsigned; a *running app* under XCUITest cannot — don't infer app entitlements from CLI test behavior.

## 2026-07-10 — [FCH-01..08] Wave 3: FS-03 Contact Card (Fiche contact), greenfield

- FS-03 was never built in the RN reference — implemented from `docs/specs/FS-03-contact-card.md` alone, wired into FS-02's seam (peek sheet's « Ouvrir la fiche », previously disabled). New `SwabCore/Fiche/` (pure, 100% covered): history events, axis identifiers, vocabulary, staleness (6-month default ⚠️ ASSUMPTION, 30-day snooze), FCH-06 filter-consequence text, FCH-08 eligibility (`targetId == nil` → envie inactive). New `SwabUI/Fiche/`: `FicheViewModel` + `FicheView` (four tap-editable axes, 12-month newest-first history, inline — never modal — staleness banner, no reciprocity signal at all: the safest reading of FCH-03's "if shown").
- `VaultContact` gained `targetId`/`history`/`lastAxisChangeAt`/`stalenessSnoozedUntil` with a **custom Codable** so pre-FS-03 blobs decode with defaults; new fiche-specific vault setters append history + reset staleness (Wave-1 `setRing` et al. untouched). Fiche opens via `.navigationDestination` *push* (not sheet), so FCH-07 (map position preserved on back) holds by construction.
- Tests: **110/110** (`xcrun swift test`), SwabCore coverage 93.94%; `FichePrivacyInvariantTests` drives real fiche edits through `VaultSync` → captures the literal HTTP body → asserts keys are exactly `{blob, version}` with zero classification plaintext. App target builds (`xcodebuild`).
- **Gotchas:** adding a non-optional stored property to a persisted `Codable` struct breaks decoding of old data unless you hand-write `init(from:)` (and then `encode(to:)` too — both-or-neither). `.navigationDestination(item:)` needs `Hashable`.
- **Flagged/deferred:** `en pause` sits under ressenti in shipped vocabulary but état in the spec — checked on both axes, needs a product decision (with OQ-FCH-1's placeholder rôles taxonomy). FCH-04 match events have a type but no writer until FS-05. FCH-07 not exercised live (no UI-test target then).

## 2026-07-10 — [MAP-01..09] Wave 2: FS-02 Relationship Map, natively

- 1:1 port of the RN reference map: `SwabCore/Carte/` (`MapGeometry` — golden-angle placement, verified against independent Python math; `EtatColors` — 3-état set, blueprint 5-état divergence carried forward flagged; `CarteLabels`; `CarteTheme` as hex strings, UI-framework-free) + `SwabUI/Carte/` (radial map with pinch/pan, animated re-tag via per-node `hasAppeared`, peek sheet with disabled FS-03 seam, ring-grouped list fallback with accessibility labels, calm empty state, exactly-3-tab `MainTabsView` — no badge API present by construction).
- MAP-05 (offline) enforced structurally: `CarteOfflineInvariantTests` scans `CarteViewModel.swift`'s source for networking symbols.
- Tests: **77/77**, SwabCore 92.73% (new Carte modules 100%). App target builds; Carte UI verified on Simulator via a temporary seeded entry view (reverted) — ring radii pixel-measured against `MapGeometry`, colors/nav/tray correct. Tap-through not scripted (no assistive-access permission in this sandbox).
- **Gotchas:** a structural source-scan test fails on its own banned tokens appearing in *comments* — phrase invariant comments without naming them. `xcrun simctl` hangs in this sandbox without `dangerouslyDisableSandbox`. `.sheet(item:)` would need a retroactive `Identifiable` conformance under tools 5.10 — used `.sheet(isPresented:)` instead. `.onChange(of:)` requires `Equatable`.
- **Deferred:** MAP-07 60fps@150 contacts unprofiled (fallback plan: single `Canvas`); clustering (OQ-MAP-1); UI/interaction tests.

## 2026-07-10 — [ONB-01..09] App shell: hand-authored .xcodeproj, @main entry, first Simulator boot

- Added `App/SwabApp.swift` (composition root over real production types: Keychain store, file KV store, vault, `ApiClient` → `http://127.0.0.1:3001`) + a hand-authored `SwabApp.xcodeproj` consuming `Package.swift` as a local package (no xcodegen — no new dependency, G4) + a checked-in shared scheme so CLI `xcodebuild -scheme` works. Bundle `com.swab.ios`, iOS 17, generated Info.plist.
- Verified: build succeeded, installed + launched on Simulator, Welcome screen screenshot-confirmed (ONB-01); persisted-step resume (ONB-08) observed working across reinstalls. 55/55 tests still green.
- **Gotchas:** `XCLocalSwiftPackageReference.relativePath` is relative to the dir *containing* the `.xcodeproj` (empty string here, not `..`). There is no `.otp` onboarding step — phone→otp is local view state by design. A never-opened-in-Xcode project has no scheme unless one is committed under `xcshareddata`; `GENERATE_INFOPLIST_FILE` fully replaces a hand-written plist.

## 2026-07-10 — [VLT-01/02/04, IDT-01/02/06, ONB-01..09] Bootstrap apps/ios: Wave 1 (FS-07 client + FS-01 onboarding)

- Created `apps/ios` as a Swift Package (`SwabCore` + `SwabUI`), zero third-party deps (CryptoKit/Security/SwiftUI only), TDD with the crypto vectors written red-first. Core: `VaultCrypto` (AES-256-GCM, wire `base64(IV‖TAG‖CT)`), `PhoneHash` (`sha256("salt:number")`), `KeychainSecureStore` (`WhenUnlockedThisDeviceOnly`), `Vault` actor (fresh-copy accessors, version increments per persist), `VaultSync` (409 → re-pull → retry once → fail loudly), `ApiClient` (no type for classification data exists, asserted by `ApiClientPrivacyInvariantTests`), onboarding state machine (persisted step, resume-at-step), full French copy port verbatim (`Fr.swift`) + MVVM onboarding screens.
- Tests: **55/55**, SwabCore 91.91%. All vault + phone-hash vectors from `docs/migration/vault-test-vectors.json` reproduced exactly.
- **Gotchas:** CryptoKit's `combined` box is `IV‖CT‖TAG` — the wire format is `IV‖TAG‖CT`; assemble by hand. Phone normalization must be ASCII `0-9` only (`Character.isNumber` matches Arabic-Indic digits and would diverge cross-platform). Bare `swift` on this machine is shadowed by OpenStack's client — always `xcrun swift`. First `getEncryptedVault()` shows version 2 (implicit first persist) — inherited RN quirk, locked in a test, not "fixed".
- **Deferred:** real `CNContactStore` importer (fake stands in; manual-add path fully capable, ONB-03 holds), SwiftUI view/snapshot tests, IDT-04/05/07..09. Not in the pnpm/turbo pipeline — run `cd apps/ios && xcrun swift test`.
