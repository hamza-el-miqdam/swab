# apps/ios — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

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
