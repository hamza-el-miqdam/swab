# SUG-AND-012 — Zero logging and blanket `catch (_: Exception)`: G3 has no Android implementation at all

- **Area:** android
- **Topic:** architecture
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-02, VLT-02 (G3 global directive)

## Problem / Opportunity

G3 (agents/_global-directives.md) requires structured logging with levels, requestId propagation "via headers", and "Mobile/web report errors via a single error-boundary reporter." The Android app has literally none of it — grep over `app/src/main` finds zero occurrences of `Log.`, `Timber`, or any logger seam.

Concrete consequences:

- `SignupViewModel` swallows every failure anonymously: `catch (_: Exception)` at SignupViewModel.kt:57-59 and :86-88 collapses DNS failure, TLS error, JSON parse error, and API 500 into the same silent `phoneError`/`otpError` flag. Debugging a live onboarding failure means adb-less guesswork.
- `MainActivity.kt:174` `runCatching { container.vaultSync.syncVault() }` discards the exception object entirely — a failed initial sync leaves no trace.
- No `requestId` is generated or sent, so client requests can never be joined to the API's pino logs (which key on `requestId` per G3).

The flip side of G3 is equally unimplemented but must stay front-of-mind: "Never log: verbs of envies, recipient lists, vault contents, phone hashes, push tokens." Adding logging naively could violate the privacy invariant — which is why a constrained seam is worth building now, before FS-05/06 land.

## Implementation plan

1. New `apps/android/app/src/main/kotlin/com/swab/android/observability/SwabLog.kt` — a deliberately narrow API that makes leaking hard:
   ```kotlin
   /** G3 logger seam. Event names only + whitelisted scalar fields. NEVER pass
    *  free-form message strings containing user data; never phoneHash, tokens,
    *  vault plaintext, display names. */
   interface SwabLogger {
       fun event(level: Level, name: String, fields: Map<String, Any?> = emptyMap())
       enum class Level { DEBUG, INFO, WARN, ERROR }
   }
   class LogcatLogger : SwabLogger { /* android.util.Log, name + JSON-ish fields */ }
   class NoopLogger : SwabLogger  // JVM tests / release default until a reporter exists
   ```
2. Wire through `AppContainer` (AppContainer.kt:23): `val logger: SwabLogger = if (BuildConfig.DEBUG) LogcatLogger() else NoopLogger()` and inject into ViewModels/VaultSync via constructor (matching the existing manual-DI style).
3. Replace the anonymous catches:
   - SignupViewModel.kt:57 → `catch (e: Exception) { logger.event(WARN, "otp.request.failed", mapOf("type" to e.javaClass.simpleName)); ... }` (same for :86; keep the existing UI-state behavior identical).
   - MainActivity.kt:174 → `.onFailure { container.logger.event(WARN, "vault.sync.initial.failed", mapOf("type" to it.javaClass.simpleName)) }`.
   - VaultSync.kt:28-30 → log `vault.sync.conflict.retry` (INFO) before the retry and `vault.sync.conflict.persisted` (ERROR) before throwing. Log version numbers (counts/IDs are explicitly allowed by G3) but never the blob.
4. requestId propagation: in `ApiClient.headers()` (ApiClient.kt:50-54) add `"x-request-id" to UUID.randomUUID().toString()` per request, and include that id in the request-failure log events so a client error joins to the API's pino line. Confirm apps/api reads `x-request-id` into its requestId (Fastify's default `requestIdHeader` is `request-id`; if apps/api expects a different header, match it — check apps/api's Fastify config first, and if it doesn't accept a client header, file an area:backend issue rather than inventing).
5. Error-boundary reporter (G3's "single error-boundary reporter"): minimum viable = a default `Thread.UncaughtExceptionHandler` installed in a new `SwabApplication` (registered in the manifest) that logs `app.crash` with exception type only, then rethrows to the prior handler. Full crash-reporting SaaS is out of scope (new dependency — G4 justification needed); say so in the PR.
6. CHANGELOG entry (G5).

## Tests & acceptance criteria

- JVM (`cd apps/android && ./gradlew test`):
  - `SwabLogPrivacyTest`: a `RecordingLogger` fake; drive `SignupViewModel.submitPhone` with a throwing transport and a real phone number input; assert the recorded events contain neither the raw number nor its hash (compute `PhoneHash.hashPhoneNumber(raw)` in the test and assert absence across all logged field values). Same for `verifyOtp` (no token material) and `VaultSync` failure paths (no blob substring).
  - `test_G3_apiClient_sendsXRequestIdHeader`: extend the `RecordingTransport` in ApiClientTest.kt:16-25 to capture headers; assert a UUID-shaped `x-request-id` is present and differs between two calls.
- Existing suites unchanged and green (`./gradlew test`, `scripts/e2e-android.sh`).

## Risks & gotchas

- The privacy blacklist is the hard invariant: no field may ever carry displayName, phoneHash, tokens, or vault plaintext. The map-of-scalars API + the privacy test is the enforcement, not the comment.
- `LogcatLogger` must be debug-only by default — logcat is world-readable pre-API 30 to apps with READ_LOGS and always readable over adb; release stays `NoopLogger` until a real reporter decision is made.
- Do not log in `Vault`/`VaultCrypto` at all — keeping the crypto path logger-free makes "vault contents can't leak via logs" true by construction.
