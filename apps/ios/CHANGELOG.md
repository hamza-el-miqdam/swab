# apps/ios — Changelog

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
