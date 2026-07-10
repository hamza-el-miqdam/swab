# RN → Native Audit & Mapping

> Companion to `docs/migration/rn-native-handoff.md`. Maps every module of the frozen RN
> reference (`apps/mobile`) to its Swift (`apps/ios`) and Kotlin (`apps/android`) target,
> in migration order. Parity is checked off per platform below as PRs land.

## Migration waves

1. **Wave 1 (this migration): FS-07 Identity & Vault + FS-01 Onboarding** — foundation + first user flow; crypto interop de-risked first via `vault-test-vectors.json`.
2. **Wave 2: FS-02 Relationship Map** — pure geometry ports 1:1; 60fps Canvas work per platform.
3. **Wave 3+: FS-03/04/05/06** — greenfield (never built in RN); built natively only, `apps/mobile` is then removable.

## Module map (RN source → native targets)

| RN module (apps/mobile) | Kind | iOS target (apps/ios/Swab) | Android target (apps/android/app/…/swab) | Wave |
|---|---|---|---|---|
| `src/vault/crypto.ts` | pure logic + keystore | `Core/Vault/VaultCrypto.swift` (CryptoKit AES.GCM, reorder combined box), `Core/Vault/VaultKeyStore.swift` (Keychain) | `vault/VaultCrypto.kt` (`Cipher AES/GCM/NoPadding`, reorder tag), `vault/VaultKeyStore.kt` (Keystore) | 1 |
| `src/lib/base64.ts` | pure logic | platform `Data(base64Encoded:)` (identical alphabet+padding) | `android.util.Base64`/`java.util.Base64` NO_WRAP | 1 |
| `src/lib/phoneHash.ts` | pure logic | `Core/Identity/PhoneHash.swift` | `identity/PhoneHash.kt` | 1 |
| `src/lib/db.ts` (SQLite kv) | platform service | `Core/Storage/KeyValueStore.swift` (file/SQLite — semantics, not storage, must match) | `storage/KeyValueStore.kt` (SharedPreferences is NOT acceptable for the blob key; blob itself is ciphertext so plain storage is fine) | 1 |
| `src/vault/vault.ts` | domain store | `Core/Vault/Vault.swift` (struct models, fresh copies) | `vault/Vault.kt` (data classes, immutable lists) | 1 |
| `src/vault/sync.ts` | domain logic | `Core/Vault/VaultSync.swift` | `vault/VaultSync.kt` | 1 |
| `src/api/client.ts` | networking | `Core/Networking/ApiClient.swift` (URLSession, async) | `network/ApiClient.kt` (coroutines) | 1 |
| `src/lib/session.ts` | platform service | `Core/Identity/Session.swift` (Keychain) | `identity/Session.kt` (Keystore-backed) | 1 |
| `src/onboarding/state.ts` | pure state machine | `Features/Onboarding/OnboardingState.swift` | `onboarding/OnboardingState.kt` | 1 |
| `src/onboarding/signup.ts` | memory-only state | `Features/Onboarding/SignupViewModel.swift` | `onboarding/SignupViewModel.kt` | 1 |
| `src/i18n/fr.ts` | normative copy | `Core/L10n/Fr.swift` (verbatim strings) | `l10n/Fr.kt` or `strings.xml` (verbatim) | 1 |
| `app/onboarding/*` (6 screens) | UI | `Features/Onboarding/*View.swift` + view models (MVVM) | `onboarding/*Screen.kt` composables + view models | 1 |
| `app/index.tsx` (resume gate, ONB-08) | routing | `App/SwabApp.swift` root gate | `MainActivity` + NavHost start-destination gate | 1 |
| `src/map/geometry.ts` | pure logic | `Features/Carte/MapGeometry.swift` | `carte/MapGeometry.kt` | 2 |
| `src/map/etatColors.ts`, `labels.ts` | pure logic | `Features/Carte/EtatColors.swift` | `carte/EtatColors.kt` | 2 |
| `src/map/{RadialMap,ContactNode,PeekSheet,RingList}.tsx` | UI | `Features/Carte/*` (Canvas) | `carte/*` (single `Canvas` composable) | 2 |
| `app/(main)/_layout.tsx` (3 tabs, label-only) | UI shell | `App/MainTabs.swift` | `MainScaffold.kt` NavigationBar | 2 |
| `src/domain/fca.ts` (seam only) | pure logic | greenfield | greenfield | 3+ |
| test infra (`jest`, node-crypto shim, Maestro) | tooling | XCTest + vectors contract tests | JUnit + vectors contract tests | 1 |

State management translation: RN uses module-level singletons + `useState` on focus. Native
targets: iOS `@Observable` view models over an actor/serial vault core; Android `ViewModel`
+ `StateFlow` over a singleton repository — same ownership boundaries (vault module is the
only holder of classification data; sync sees ciphertext only).

## Wave 1 parity checklist (FS-07 client scope + FS-01)

Requirement coverage: IDT-01/06 (client side: hash-before-send), VLT-01/02/04 (client), ONB-01..09.

Status as of 2026-07-10 (iOS: `apps/ios/CHANGELOG.md`, 55/55 tests, 91.9% coverage on `SwabCore`,
plus a hand-authored `SwabApp.xcodeproj` app shell; Android: `apps/android/CHANGELOG.md`, 47/47
tests, 98.1% domain coverage). ✅ = verified by an automated test or an actual run on real
Simulator/emulator hardware on this host. 🟡 = implemented, compiles against real platform APIs,
but not yet exercised end-to-end.

Both apps were built, installed, and launched for real: iOS on the "iPhone 17" Simulator
(`xcodebuild` → `xcrun simctl install/launch`), Android on a `Pixel_6_Pro` emulator (`gradlew
assembleDebug` → `adb install` → `adb shell am start`).

**Android went further: a full live walkthrough against a running `apps/api`**
(`docker compose up`) — welcome → phone → OTP request → new-user name prompt → OTP verify →
contacts screen, driven via `adb shell input` and cross-checked against the API's own request
logs (not just screenshots). This surfaced and fixed two real bugs before they'd have hit a real
device: (1) `ApiClient`'s default base URL doesn't reach the host Mac from the emulator (fixed via
a per-build-type `BuildConfig.API_BASE_URL` + debug-only cleartext network security config), and
(2) `AndroidKeystoreVaultKeyStore` threw `InvalidAlgorithmParameterException` on first vault-key
creation because Android Keystore AES/GCM keys reject a caller-supplied IV on `ENCRYPT_MODE` by
default (fixed; regression-tested with 2 new instrumented tests in
`AndroidKeystoreVaultKeyStoreTest`, run via `./gradlew connectedDebugAndroidTest` against the real
Keystore). A third bug — `SignupViewModel` losing pending-phone state across Phone→OTP navigation
because it was `remember`ed per-`composable{}` instead of hoisted to `NavHost` scope — was also
found and fixed during the same walkthrough. Full details: `apps/android/CHANGELOG.md`'s
2026-07-10 "On-device walkthrough" entry.

**iOS confirmed running (Welcome screen, French copy, no crash, ONB-08 resume proven live) but
not walked further**: this sandboxed environment has no assistive-access permission for scripted
UI automation on the iOS Simulator (`osascript`/System Events taps are blocked — `-1719`), so
phone→OTP→contacts could not be driven non-interactively the way Android was via `adb shell
input`. iOS's Keychain/CryptoKit vault-key path (`SecureStore` storing the raw generated key
directly) is architecturally different from Android's envelope-encryption-via-non-exportable-
Keystore-key approach, so the specific IV bug found on Android does not apply there — but that is
an architectural argument, not an on-device proof, and a live iOS walkthrough remains open.

| Criterion | iOS | Android |
|---|---|---|
| Crypto vectors (`vault-test-vectors.json`) reproduced exactly | ✅ | ✅ |
| Phone-hash vectors reproduced exactly | ✅ | ✅ |
| Vault encrypted at rest; key in OS keystore; fresh-copy accessors (VLT-01) | ✅ (Keychain exercised directly by unsigned CLI test process) | ✅ (live: `getOrCreateVaultKey()` succeeds against the real Keystore after ONB-02's OTP-verify step; also 2 new instrumented tests) |
| Sync: push, 409 → re-pull + retry once (VLT-02) | ✅ | ✅ |
| API client sends only `phoneHash`/`code`/`displayName`/`{blob,version}` (ONB-05, asserted via test) | ✅ | ✅ (also confirmed live against real API request logs) |
| Onboarding flow welcome→phone→otp→contacts→calibrate→done (ONB-01..07), French copy verbatim | 🟡 Welcome confirmed on Simulator (screenshot-verified); phone/otp/contacts/calibrate/done not walked live (no scripted input available in this environment) | ✅ welcome→phone→otp(+needsName)→contacts walked live end-to-end against the real API; calibrate/done not walked (no reason to expect issues — same pattern as contacts) |
| Resume-at-step after process kill (ONB-08); step stays `phone` until OTP verified | ✅ (unit tests; also incidentally confirmed live — a stale app container resumed straight to Phone on relaunch) | ✅ (unit tests; live walkthrough also exercised the happy path through OTP verify) |
| Contacts denied → manual entry, identical capabilities (ONB-03) | 🟡 (manual path ✅; real `CNContactStore` import deferred, fake stands in) | 🟡 (manual path ✅; real `ContentResolver` import deferred, stub) |
| État/ressenti layer optional + collapsed (ONB-06); no gamification (ONB-09, asserted via copy test) | ✅ | ✅ |
| Airplane-mode: calibration persists locally, syncs later, only `POST /vault` carries derived data | ✅ (unit-level) | ✅ (unit-level) |

**Remaining before Wave 1 is fully 🟢 on both platforms:** a full live walkthrough (welcome →
phone → OTP → contacts → calibrate → done) against a running `apps/api` instance
(`docker compose up --build`), which would exercise Android's real Keystore/DataStore adapters and
both platforms' vault-key creation on real hardware for the first time. Real contacts-import
(Contacts framework / `ContentResolver`) is stubbed on both platforms; the manual-entry path
already satisfies ONB-03's denial-parity acceptance criterion. FS-02's real radial
`Canvas`/`MapGeometry` module (Wave 2) is out of scope — both platforms use a minimal
list/ring-button calibration interaction for now, matching the RN reference's own stated v0.
