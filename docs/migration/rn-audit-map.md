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

Status as of 2026-07-10 (iOS: `apps/ios/CHANGELOG.md`, 55/55 tests, 91.9% coverage on `SwabCore`;
Android: `apps/android/CHANGELOG.md`, 47/47 tests, 98.1% domain coverage). ✅ = verified by an
automated test on this host. 🟡 = implemented, compiles against real platform APIs, but
unverified on-device (no simulator boot / no emulator available in this environment).

| Criterion | iOS | Android |
|---|---|---|
| Crypto vectors (`vault-test-vectors.json`) reproduced exactly | ✅ | ✅ |
| Phone-hash vectors reproduced exactly | ✅ | ✅ |
| Vault encrypted at rest; key in OS keystore; fresh-copy accessors (VLT-01) | ✅ (Keychain exercised directly by unsigned CLI test process) | 🟡 (fresh-copy accessors ✅; `AndroidKeystoreVaultKeyStore` unverified on-device) |
| Sync: push, 409 → re-pull + retry once (VLT-02) | ✅ | ✅ |
| API client sends only `phoneHash`/`code`/`displayName`/`{blob,version}` (ONB-05, asserted via test) | ✅ | ✅ |
| Onboarding flow welcome→phone→otp→contacts→calibrate→done (ONB-01..07), French copy verbatim | 🟡 (logic + copy ✅; SwiftUI screens have no view-level tests) | 🟡 (logic + copy ✅; Compose screens unverified on-device) |
| Resume-at-step after process kill (ONB-08); step stays `phone` until OTP verified | ✅ | ✅ |
| Contacts denied → manual entry, identical capabilities (ONB-03) | 🟡 (manual path ✅; real `CNContactStore` import deferred, fake stands in) | 🟡 (manual path ✅; real `ContentResolver` import deferred, stub) |
| État/ressenti layer optional + collapsed (ONB-06); no gamification (ONB-09, asserted via copy test) | ✅ | ✅ |
| Airplane-mode: calibration persists locally, syncs later, only `POST /vault` carries derived data | ✅ | ✅ (unit-level; no manual on-device airplane-mode run) |

**Remaining before Wave 1 is fully 🟢 on both platforms:** an `.xcodeproj`/`@main` app shell for
iOS (no `xcodegen` — unjustified new dep, per G4) and on-device/emulator verification for both
platforms (Keystore, DataStore, Compose screens, SwiftUI screens) — this dev machine has the
Android SDK but no running emulator, and no iOS simulator was booted for this pass. Real
contacts-import (Contacts framework / `ContentResolver`) is stubbed on both platforms; the
manual-entry path already satisfies ONB-03's denial-parity acceptance criterion. FS-02's real
radial `Canvas`/`MapGeometry` module (Wave 2) is out of scope — both platforms use a minimal
list/ring-button calibration interaction for now, matching the RN reference's own stated v0.
