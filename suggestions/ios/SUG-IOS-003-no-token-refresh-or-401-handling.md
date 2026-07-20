# SUG-IOS-003 — Refresh token is stored but never used: expired access token makes sync fail silently forever

- **Area:** ios
- **Topic:** correctness
- **Impact:** high
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** IDT-02, VLT-02, VLT-04

## Problem / Opportunity

IDT-02 (`docs/specs/FS-07-identity-vault.md:15`) specifies short-lived JWT access tokens plus rotating refresh tokens. The iOS client saves both (`OnboardingViewModels.swift:115`, `Session.saveTokens`, `apps/ios/Sources/SwabCore/Identity/Session.swift:24-27`) but:

- `Session` exposes only `getAccessToken()` (`Session.swift:29-31`); there is no `getRefreshToken()` and nothing in `Sources/` ever reads `swab.session.refresh.v1` back (grep confirms the only `refreshToken` references are the save path and the DTO).
- `ApiClient` has no refresh endpoint call and no 401 handling: `pushVault`/`getVault` (`apps/ios/Sources/SwabCore/Networking/ApiClient.swift:146-171`) treat 401 as a generic `ApiError.http(status:)`.
- The only sync caller swallows the error (`try? await vaultSync.sync()`, `OnboardingViewModels.swift:252`).

Net effect: once the short-lived access token expires, every future vault sync 401s and the failure is invisible — the user's server-side vault backup silently stops updating (compounding SUG-IOS-002). This is a correctness gap against the spec'd session model, not just polish.

Note: verify the API exposes a refresh endpoint (check `apps/api/src/routes/auth.ts`); if it does not, open an `area:api` issue first and split this into client-side scaffolding + a follow-up.

## Implementation plan

1. `Session.swift`: add `public func getRefreshToken() throws -> String?` mirroring `getAccessToken()`, and `public func clearTokens() throws` (needs `SecureStore.delete` — see SUG-IOS-012; until then, overwrite with empty string and treat empty as nil in getters).
2. `ApiClient.swift`: add wire types `RefreshBody: Encodable { let refreshToken: String }` and `RefreshResponse: Decodable { accessToken, refreshToken }`, and `public func refreshSession() async throws -> OtpVerifyResponse` posting to the API's refresh path.
   - **Privacy tripwire:** `ApiClientPrivacyInvariantTests.allowedFieldNames` (`Tests/SwabCoreTests/ApiClientPrivacyInvariantTests.swift:13-15`) must be extended with `refreshToken`, and `test_ONB05_encodableSurfaceIsExactlyTheKnownRequestBodies` (`:47-57`) must add the new body and bump the count to 4 — deliberate, reviewed additions.
3. Add a retry-once-on-401 wrapper inside `ApiClient` for authenticated calls (`pushVault`, `getVault`): on 401 → `refreshSession()` → `session.saveTokens(...)` → replay the original request once; a second 401 surfaces as a new `ApiError.unauthorized` case so callers can distinguish "session dead, re-onboard" from transient errors.
4. Surface terminal auth failure: `VaultSync.sync()` should let `ApiError.unauthorized` propagate; the scheduler/reporter (SUG-IOS-002/005) records it instead of retrying forever.

## Tests & acceptance criteria

- Extend `Tests/SwabCoreTests/ApiClientTests.swift` using the existing `FakeHTTPTransport`, upgraded to a scripted sequence of stubs:
  - `test_IDT02_pushVault_401_refreshesAndRetriesOnce` — sequence 401 → 200(refresh) → 200(push); asserts the second push carries the NEW bearer token and the refresh request carried the stored refresh token.
  - `test_IDT02_refreshRotation_persistsNewRefreshToken` — after refresh, `store.get("swab.session.refresh.v1")` equals the rotated value.
  - `test_IDT02_secondConsecutive401_throwsUnauthorizedWithoutLoop` — sequence 401 → 200(refresh) → 401; exactly 3 transport calls, error is `.unauthorized`.
- Extend `ApiClientPrivacyInvariantTests` with `test_ONB05_refreshBody_onlyContainsRefreshToken`.
- Run: `cd apps/ios && xcrun swift test`; `scripts/e2e-ios.sh` unchanged-green.

## Risks & gotchas

- IDT-02's "refresh reuse detection revokes the family" means the client must persist the rotated refresh token atomically before retrying, or a crash mid-rotation kills the session; save tokens before replaying the request.
- Keep the allow-list additions minimal and named exactly — that test is the product's privacy tripwire; widening it casually would be a review flag.
- Concurrency: two simultaneous 401s (e.g. push + get) must not both refresh — `ApiClient` is an actor, so serialize refresh through a single in-flight `Task` stored on the actor.
