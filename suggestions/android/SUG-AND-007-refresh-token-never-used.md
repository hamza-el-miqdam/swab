# SUG-AND-007 — Refresh token is stored but never used: no 401 handling, sessions silently die when the access JWT expires

- **Area:** android
- **Topic:** correctness
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** IDT-02, VLT-02

## Problem / Opportunity

IDT-02 (docs/specs/FS-07-identity-vault.md:15) specifies "short-lived JWT access token + rotating refresh token per device". The Android client:

- Saves both tokens once at OTP verify (SignupViewModel.kt:74) into `KeystoreTokenStore` (KeystoreTokenStore.kt:18-21).
- Never reads the refresh token again — `SecureTokenStore` (Session.kt:10-13) doesn't even expose a getter for it; grep across `src/main` confirms `REFRESH_KEY` is written and never read.
- Has no 401 handling anywhere: `ApiClient.pushVault`/`getVault` (ApiClient.kt:78-95) throw a generic `ApiError` on 401, `VaultSync.syncVault` (VaultSync.kt:18-32) doesn't catch it, and MainActivity's single call swallows it via `runCatching` (MainActivity.kt:174).

Consequence: as soon as the short-lived access token expires, every vault sync fails forever, silently. The user's local edits never reach the server again (compounding SUG-AND-001), with no re-auth path — the app has no logout/login surface post-onboarding.

Note: verify the API's refresh endpoint contract first (apps/api). The client networking layer today has only the four endpoints from the handoff table (docs/migration/rn-native-handoff.md:77-82), which lists no refresh route — if the API doesn't expose one yet, open an `area:backend` issue and stop (G4) rather than inventing a contract.

## Implementation plan

1. Confirm/obtain the refresh endpoint from apps/api (expected shape: `POST /auth/refresh` `{ refreshToken }` → `{ accessToken, refreshToken }`). If absent, file the backend issue and pause this task.
2. Extend `SecureTokenStore` (Session.kt): add `suspend fun getRefreshToken(): String?` and `suspend fun clear()`. Implement in `KeystoreTokenStore` and `InMemorySecureTokenStore`.
3. Add to `ApiClient` (ApiClient.kt):
   ```kotlin
   @Serializable data class RefreshBody(val refreshToken: String)
   suspend fun refreshSession(body: RefreshBody): OtpVerifyResponse
   ```
   Same shape discipline as the file header demands (ApiClient.kt:9-16): no new user-data fields beyond the token string.
4. New `apps/android/app/src/main/kotlin/com/swab/android/identity/SessionRefresher.kt`:
   ```kotlin
   class SessionRefresher(private val apiClient: ApiClient, private val tokenStore: SecureTokenStore) {
       private val mutex = Mutex() // single-flight: concurrent 401s refresh once
       suspend fun refresh(): Boolean // false => refresh token invalid/absent -> session dead
   }
   ```
5. Retry-once-on-401 wrapper: give `VaultSync` (or a thin `AuthedApiClient` decorator) the pattern: on `ApiError(status = 401)` → `sessionRefresher.refresh()` → replay the request once; if refresh fails, propagate a typed `SessionExpiredException`. Wire in AppContainer.
6. Session-dead UX: on `SessionExpiredException` during sync, keep vault edits local (they already are) and route the user back to the PHONE onboarding step is heavy-handed; minimum honest behavior for POC: expose a `sessionExpired` flag the Carte can quietly surface. Any user-facing copy must come from specs — coordinate with spec-specialist; flag as ⚠️ ASSUMPTION otherwise (Fr.kt:12-14 rule).
7. CHANGELOG entry (G5).

## Tests & acceptance criteria

JVM (`cd apps/android && ./gradlew test`), reusing the `ScriptedTransport` pattern (VaultSyncTest.kt:17-24):

- `test_IDT02_pushVault401_refreshesOnce_thenRetriesWithNewToken`: script 401 → refresh 200 (new tokens) → push 200; assert the second push carried `authorization: Bearer <newAccessToken>` (capture headers in the fake transport — extend the recorded triple to include headers).
- `test_IDT02_refreshRotation_persistsNewRefreshToken`: after refresh, `tokenStore.getRefreshToken()` returns the rotated value.
- `test_IDT02_refreshFails_surfacesSessionExpired_withoutLoop`: 401 → refresh 401; assert exactly 2 requests and `SessionExpiredException`.
- `test_IDT02_concurrent401s_singleRefreshCall` with two parallel `syncVault` calls under `runTest`.
- Existing `ApiClientTest`/`VaultSyncTest` stay green.

## Risks & gotchas

- Refresh-reuse detection is server-side (IDT-02) — the client must always persist the NEWEST rotated refresh token atomically before retrying, or a crash between refresh and save kills the family.
- Never log tokens (G3: "never log … push tokens" applies a fortiori to session tokens) — log only status codes/counts.
- The retry wrapper must not retry non-401 errors and must retry at most once (no loops against a revoked family).
- Keep `accessTokenProvider` (AppContainer.kt:32) as the single header source so the replayed request picks up the fresh token.
