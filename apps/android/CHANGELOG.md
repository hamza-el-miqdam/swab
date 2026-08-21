# apps/android — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

> Entries before 2026-08-15 are archived in [../../docs/archive/android-CHANGELOG-pre-2026-08-15.md](../../docs/archive/android-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

## 2026-08-21 — [FCH-04, VLT-03] SUG-AND-013 prune vault history to 12 months on write, not just on read

- **What changed:** `Vault.recordAxisEdit` now prunes `history` to the trailing 12 months (new `Vault.HISTORY_RETENTION_MILLIS`) inside its existing lock, in the same persist as the append. `FicheViewModel` drops its own local `TWELVE_MONTHS_MILLIS` and filters against `Vault.HISTORY_RETENTION_MILLIS` instead, so read- and write-time windows can't drift.
- **Why:** the list only ever grew — FCH-04's 12-month window was applied at read time only, so the stored blob kept every axis edit since install against VLT-03's ≤ 1 MB server quota. Every chip tap on the fiche is an edit, so an active user with years of re-tags would eventually hit the quota with no client-side handling.
- **Gotcha:** the prune is blob-wide (one flat history list for the whole vault, unlike iOS's per-contact nesting), which is correct — the quota is on the blob and FCH-04 never shows anything out of window regardless of contact. `FicheViewModel`'s read-time filter stays as a second line of defence for blobs written before this landed.
- Follow-up noted in code, not implemented: when contact deletion lands, it must also prune that contact's history rows.
- Verified: `./gradlew test` 154/154, including 4 new/regression cases. `pnpm turbo run lint typecheck test build` clean except the pre-existing, unrelated `apps/api` `prisma-repo.test.ts` (needs a live Postgres this sandbox doesn't have — same suite CI runs against its `postgres:17` service).

## 2026-08-20 — [G3] SUG-AND-012 a logging seam + crash reporter, where there was none

- **What changed:** new `observability/SwabLog.kt` (`SwabLogger`: `LogcatLogger` debug-only, `NoopLogger` release/test default), wired through `AppContainer`. `SignupViewModel`'s two anonymous `catch (_: Exception)` blocks, `MainActivity`'s discarded initial-sync failure, and `VaultSync`'s 409-retry path now log an event name + whitelisted scalar fields (never the raw phone number, its hash, tokens, or the vault blob). `ApiClient` sends a fresh `x-request-id` per request — `apps/api` already reads that header (`app.ts:68`), so client and server logs now correlate. New `SwabApplication` installs a default `UncaughtExceptionHandler` (logs exception type only, then rethrows) as the minimum-viable G3 error-boundary reporter.
- **Why:** G3 required structured logging + a single error-boundary reporter; the Android app had zero logger seam (`grep -r "Log\."` found nothing), so a live onboarding/sync failure was undebuggable without adb-less guesswork.
- **Gotcha:** the privacy blacklist is enforced by `SwabLogPrivacyTest`, not just the doc comment on `SwabLogger.event` — never widen a logged field to a free-form string that could carry user data.
- No crash-reporting SaaS added (new dependency, no G4 justification yet) — `SwabApplication` only logs and rethrows.
- E2E gate not run this PR (worker operates without an emulator); JVM suite green (`./gradlew test`).

- **What changed:** new `fiche/ClassificationValues.kt` with `Etat` / `Ressenti` / `RoleContexte` (identifiers per FS-03 § *Stored value vocabulary*). The vault persists `busy`, not `occupé`; `EtatColors.ETAT_COLORS` is keyed by `Etat` instead of by `Fr.ETAT_*`; `FicheFilterConsequence.forValue` takes an `Etat?`; `Vault`'s setters take the typed value, so writing display copy into the vault is a compile error.
- **Why:** ADR-001 stage 0b, mirroring iOS `SUG-IOS-011`. Rewording a label — or shipping the planned Arabic locale — silently orphaned every stored value. After stage 2 these are database columns and the same rewording becomes a data migration.
- **The Kotlin-specific trap this fixes:** Swift's `String ==` compares by canonical equivalence, so « occupé » matches whether stored NFC or NFD. **Kotlin compares UTF-16 code units and does not** — an NFD-encoded legacy token would silently fail to migrate and read as unknown. Both the frozen legacy table and every lookup normalise to NFC. Pinned by a test built from `\u` escapes (a literal would be whatever the editor saved) and verified non-vacuous: removing the NFC pass fails it.
- **Nothing user-visible changes.** Chips render labels, taps carry values. `Vocab` now exposes typed lists plus `*_LABELS`, derived from the enums so the two can no longer drift; `FicheScreen`'s private duplicate `ROLES` list is gone (SUG-AND-017 consolidated ÉTAT/RESSENTI but missed roles).
- **Dual-read is permanent**, applied at the vault's single hydration point. Unknown tokens (`douceur`, `confidente`, still in `vault-test-vectors.json`) round-trip verbatim and render unset. History summaries deliberately keep the display label — FCH-04 hands event creation to the server at stage 2.
- Verified: `./gradlew test` **292/292** · `scripts/e2e-android.sh` **PASS**, 37/37, zero drift (Pixel_6_Pro API 34 — API 35+ still breaks Espresso, issue #56).

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

