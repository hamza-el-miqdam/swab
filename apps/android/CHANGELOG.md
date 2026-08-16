# apps/android — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

> Entries before 2026-08-15 are archived in [../../docs/archive/android-CHANGELOG-pre-2026-08-15.md](../../docs/archive/android-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

## 2026-08-16 — [IDT-02, VLT-01] SUG-AND-006 session tokens are Keystore-encrypted at rest (were plaintext)

- `KeystoreTokenStore` wrote both JWTs as **plaintext** into DataStore despite its name; `Session.kt` claimed "Production storage is Keystore-backed". Neither was true. The refresh token is a long-lived credential, so a rooted device or a bad extraction path yielded account takeover (`allowBackup="false"` helps but is not encryption). ADR-001 raised the stakes: with classification data now server-side, the session token is the only thing guarding a user's whole relationship map.
- New `security/KeystoreEnvelope.kt` holds the envelope crypto, extracted from `AndroidKeystoreVaultKeyStore` so both callers share one proven implementation. Tokens use a **separate alias** `swab.session.wrap.v1` — clearing or invalidating one must not affect the other.
- **Gotcha (do not change):** the vault alias `swab.vault.wrap.v1`, the kv key, and the `IV ‖ CT ‖ TAG` on-disk layout are byte-identical after the extraction — altering any of them bricks every installed vault. `LegacyVaultCompatE2ETest` passing on-device is the proof.
- **Gotcha:** `getOrCreateVaultKey()` still *throws* on failure by design — `Vault.hydrate()`/`persist()` catch it to surface `Unreadable` (SUG-AND-004). Only the token reads fail closed to `null`. Do not "helpfully" make the vault path return null.
- Migration: any value that does not decrypt — including a pre-2026-08-16 plaintext token — reads as `null`, i.e. logged out, and the user re-auths via OTP. Deliberately no JWT-shape sniffing: silently re-encrypting an attacker-planted value is worse than a re-login.
- `SecureTokenStore.getRefreshToken()` added (needed by SUG-AND-007). Tests: 132 JVM green; 14 new/regression instrumented tests green on API 34.
- **E2E gate PASS — 37/37, zero drift** (`scripts/e2e-android.sh`, Pixel_6_Pro API 34). This covers the integrated signup → save-tokens → authenticated-request path, not just the unit round-trip. **Gotcha for the next person:** the gate needs no Docker — boot the API with `buildApp({ repo: fakeRepository(), dbHealth: stub })` and a dummy `DATABASE_URL` (only Prisma reads it) plus `OTP_DEV_CODE=enabled`. It DOES need an **API 34** emulator: on API 37 the pinned Espresso dies in `onIdle` with `NoSuchMethodException: InputManager.getInstance` before any app code runs (issue #56).

## 2026-08-16 — [VLT-01, VLT-05, MAP-05] SUG-AND-004 a corrupt blob or lost Keystore key no longer crashes the app

- `Vault.hydrate()` decrypted+decoded with zero error handling — a tampered/truncated blob, a lost/invalidated Keystore key, or malformed plaintext threw an uncaught exception inside `viewModelScope.launch` (no `CoroutineExceptionHandler`), crashing the process. Since Carte hydrates on launch, one corrupt byte on disk meant a permanent crash loop.
- Added `VaultLoadState` (`Ok`/`Unreadable`) and `Vault.loadState()`. `hydrate()` now catches the decrypt/decode/Keystore failure, sets `Unreadable`, and keeps an empty in-memory `VaultData` — the on-disk blob is left untouched so it stays recoverable. `persist()` rejects writes while `Unreadable` (no-op, not a thrown exception, so unguarded ViewModel callers still can't crash) and also catches a Keystore failure that surfaces only on write.
- `CarteViewModel.vaultUnreadable` surfaces the state; `CarteScreen` shows a calm line (`Fr.CARTE_VAULT_UNREADABLE`, placeholder copy — `⚠️ ASSUMPTION`, mirrors the `FICHE_STALE_TITLE` precedent) instead of hiding the failure behind a quietly-empty map.
- New `VaultCorruptionTest` (truncated blob, wrong-key/tampered blob, no-overwrite-while-unreadable, healthy-blob regression) + one `CarteViewModelTest` case. `./gradlew test`: all suites green.
- Not done: `FicheViewModel`/`ContactsViewModel` still read the vault unguarded — same failure mode on those screens is a follow-up, not required to fix Carte's launch crash.

## 2026-08-15 — [SUG-AND-011] Enforce the G2 80% domain-coverage floor, don't just report it

- `jacocoDomainCoverage` generated an XML/HTML report but nothing failed the build below the 80% floor — the numbers quoted in this changelog were self-reported from manual runs. Added `jacocoDomainCoverageVerification` (`JacocoCoverageVerification`), reusing the exact `classDirectories`/`sourceDirectories`/`executionData` wiring (hoisted `classDir` to file scope so both tasks share it) and the same `domainCoverageExcludes` scope, so report and gate can never disagree.
- Wired into the standard lifecycle: `tasks.named("check") { dependsOn("jacocoDomainCoverageVerification") }` — cannot be skipped once `check` runs.
- `./gradlew jacocoDomainCoverageVerification`: BUILD SUCCESSFUL (current domain coverage ~98%, far above the floor).
- **Follow-up (not in this PR, area:sre scope):** `.github/workflows/ci.yml`'s `android-unit` job runs `./gradlew test`, which does not pull in `check`'s dependencies — the new gate isn't yet exercised in CI. Needs a devops-specialist PR changing that step to `./gradlew check` (or adding the verification task explicitly).

