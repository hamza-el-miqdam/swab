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
| Onboarding flow welcome→phone→otp→contacts→calibrate→done (ONB-01..07), French copy verbatim | 🟡 Welcome confirmed on Simulator (screenshot-verified); phone/otp/contacts/calibrate/done not walked live (no scripted input available in this environment) | ✅ full walkthrough welcome→phone→otp(+needsName)→contacts→calibrate→done→Carte driven live twice (2026-07-10, Wave 1 verification and again ahead of Wave 2), zero crashes |
| Resume-at-step after process kill (ONB-08); step stays `phone` until OTP verified | ✅ (unit tests; also incidentally confirmed live — a stale app container resumed straight to Phone on relaunch) | ✅ (unit tests; live walkthrough also exercised the happy path through OTP verify) |
| Contacts denied → manual entry, identical capabilities (ONB-03) | 🟡 (manual path ✅; real `CNContactStore` import deferred, fake stands in) | 🟡 (manual path ✅; real `ContentResolver` import deferred, stub) |
| État/ressenti layer optional + collapsed (ONB-06); no gamification (ONB-09, asserted via copy test) | ✅ | ✅ |
| Airplane-mode: calibration persists locally, syncs later, only `POST /vault` carries derived data | ✅ (unit-level) | ✅ (unit-level) |

**Remaining before Wave 1 is fully 🟢 on both platforms:** the same live walkthrough on iOS
(blocked on this host's lack of assistive-access permission for scripted Simulator input — an
XCUITest target would sidestep this if picked up later) and real contacts-import (both platforms
stub it; manual entry already satisfies ONB-03's denial-parity criterion).

**Known bug found during the Android walkthrough, tracked but not yet fixed (pre-existing Wave 1
code, unrelated to Wave 2):** `apps/android/app/src/main/kotlin/com/swab/android/ui/onboarding/CalibrateScreen.kt`'s
ring-picker `Row` (4 `GhostButton`s: "Anneau 1"..."Anneau 4") renders the 3rd/4th buttons squeezed
into a vertical column of single characters on the `Pixel_6_Pro` emulator once a contact is
selected — almost certainly a `Row` width-overflow/measurement issue with 4 unconstrained
`TextButton`s exceeding available width. Does not block calibration (ring 1/2 buttons work fine,
and any ring is reachable by keyboard/other means), but should be fixed before this screen ships.

## Wave 2 parity checklist (FS-02 Relationship Map)

Requirement coverage: MAP-01..09.

Status as of 2026-07-10. iOS: `apps/ios/CHANGELOG.md`, 77/77 tests (22 new), 92.73% `SwabCore`
coverage, 100% on the 3 new pure Carte modules. Android: `apps/android/CHANGELOG.md`, 80/80 tests
(33 new), 98.4% domain coverage, 100% on the new `carte` package.

**Android went further again: a full live walkthrough** — this time driven by the lead directly
(not delegated), reaching the actual Carte screen via a real onboarding run (welcome → phone → OTP
→ 2 manually-added contacts → calibrate → done) against the live API, then interacting with the
rendered map: tapped a contact node → peek sheet opened correctly (Intimité/État/Rôles, disabled
"Ouvrir la fiche"), toggled list mode → contacts correctly grouped under "Très proche", zero
crashes. This live pass also caught and fixed a real density-scaling bug (see Android changelog):
`MapGeometry`'s dp-equivalent units were run through `Float.toDp()` (which expects raw pixels) —
a double conversion that collapsed the whole map to ~1/3.5 size and made contact nodes appear to
overlap "moi" on the emulator's 3.5x-density display. No JVM test could have caught this.

**iOS**: build succeeds for the real Simulator app target; a temporary seeded view (reverted after,
`git diff` on `SwabApp.swift` shows only the intended 6-line wiring) confirmed the map renders
pixel-accurately (ring radii, spoke lines, état colors, unplaced tray, 3-tab nav) via screenshot.
Interactive verification (tap → peek sheet, pinch/pan) was not possible — same assistive-access
blocker as Wave 1.

| Criterion | iOS | Android |
|---|---|---|
| MAP-01 (radial layout, moi centered, ring from vault) | ✅ (unit-tested geometry + screenshot-verified) | ✅ (unit-tested + live-verified) |
| MAP-02 (exactly 3 nav items, no badges) | ✅ (no badge API surface exists in the file, by construction) | ✅ (same, + live-verified) |
| MAP-03 (état/ring visual encoding) | ✅ | ✅ |
| MAP-04 (tap → peek sheet, animated re-tag, disabled fiche seam) | 🟡 implemented + code-reviewed; not interaction-tested (no UI test target, no scripted taps) | ✅ live-verified: tap opens the peek sheet with correct rows and the disabled fiche button |
| MAP-05 (offline-first, no network) | ✅ (structural source-scan test) | ✅ (structural source-scan test) |
| MAP-06 (calm empty state) | ✅ (copy wired; not exercised live with zero contacts) | ✅ (copy wired; not exercised live with zero contacts) |
| MAP-07 (≤150 contacts, 60fps pan/zoom) | 🟡 geometry math verified at scale; no Instruments profiling done | 🟡 geometry math verified at n=150 in `MapGeometryTest`; no Perfetto/60fps profiling done |
| MAP-08 (screen-reader list fallback) | ✅ (accessibility-label test) | ✅ (accessibility-label test + live-verified list mode) |
| MAP-09 (no counters/search/sorting) | ✅ (copy-ethos test covers all new strings) | ✅ (copy-ethos test covers all new strings) |

**Remaining before Wave 2 is fully 🟢 on both platforms:** iOS interactive verification (peek
sheet tap, pinch/pan) once a scripted-input path exists; 60fps/jank profiling under a realistic
~150-contact load on both platforms (OQ-MAP-1 clustering itself stays explicitly out of scope per
the spec); the pre-existing `CalibrateScreen` ring-picker layout bug noted above.
