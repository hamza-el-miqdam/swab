# apps/android — Changelog

Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, newest first (G5).

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
