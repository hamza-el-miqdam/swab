# apps/ios — Changelog

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
