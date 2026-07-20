# SUG-AND-018 — Small hygiene sweep: unused import, cleartext default base URL, unguarded test seam, hardcoded phone-hash salt

- **Area:** android
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** IDT-01, IDT-06

## Problem / Opportunity

Four independent nits, each individually verified:

1. **Unused import** — /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/MainActivity.kt:20 imports `androidx.lifecycle.viewmodel.compose.viewModel`; grep of the file shows `viewModel(` is never called (all VMs are built with `remember`/direct construction). (Becomes moot if SUG-AND-003 lands first — then the import is used; drop this item in that case.)
2. **Cleartext default base URL** — `ApiClient.DEFAULT_BASE_URL = "http://localhost:3001"` (ApiClient.kt:44-46). Production wiring always overrides it with `BuildConfig.API_BASE_URL` (AppContainer.kt:31), so the default exists only as a footgun: a future call site that forgets the parameter silently points at cleartext localhost and fails opaquely on-device (the network-security config blocks cleartext outside debug — the failure would be a confusing `CleartextNotPermitted`). Tests pass their own URLs already (ApiClientTest.kt:30 etc.).
3. **Unguarded test seam in production API** — `Vault.resetForTests()` (Vault.kt:208-212) is a public method on the production class, callable from any main-source code, and bypasses the mutex while mutating `cache`/`version`. It has no annotation marking intent.
4. **Salt not deployment-configurable** — `PhoneHash.DEFAULT_SALT = "swab-poc-phone-salt-v1"` is a hardcoded constant (PhoneHash.kt:12). The handoff contract (docs/migration/rn-native-handoff.md:65-67) specifies the salt as a *per-deployment* namespace delivered via env in the RN reference (`EXPO_PUBLIC_PHONE_HASH_SALT`), and "Native apps must use the same value per deployment or contact discovery breaks" (IDT-06). Android has no override channel, so a future salt rotation or a staging deployment with a distinct namespace requires a code change instead of a build flag.

## Implementation plan

1. Delete the import at MainActivity.kt:20 (skip if SUG-AND-003 is implemented first).
2. Remove the default value: make `baseUrl` a required `ApiClient` constructor parameter (delete the `companion object` at ApiClient.kt:44-46 entirely; grep shows `DEFAULT_BASE_URL` has no other reference in src/main). Update test call sites — they already pass explicit URLs except `VaultSyncTest`'s `ApiClient(transport)` constructions (VaultSyncTest.kt:34, 55, 77, 91) and one in FichePrivacyLeakTest if present: pass `baseUrl = "http://test"` there.
3. Annotate the test seam: add `@androidx.annotation.VisibleForTesting` on `resetForTests()` (androidx.annotation comes transitively with core-ktx; if not resolvable, add the tiny `androidx.annotation:annotation` artifact with the G4 justification "lint-enforced test-seam marking" — or, cheaper, make the method `internal` and note that unit tests live in the same module so visibility still works).
4. Salt via BuildConfig, mirroring `API_BASE_URL` (build.gradle.kts:43-50): add `buildConfigField("String", "PHONE_HASH_SALT", "\"swab-poc-phone-salt-v1\"")` to both build types, and change `PhoneHash.hashPhoneNumber`'s default parameter usage at the call sites that must be deployment-aware (SignupViewModel.kt:51, ContactsViewModel.kt:44) to pass `BuildConfig.PHONE_HASH_SALT`. Keep `DEFAULT_SALT` in `PhoneHash` for the JVM vector tests (PhoneHashVectorTest depends on the documented default salt value — the vectors are generated with it, rn-native-handoff.md:177).
5. CHANGELOG entry (G5) covering all four.

## Tests & acceptance criteria

- `cd apps/android && ./gradlew test` — full JVM suite green after the constructor change; `PhoneHashVectorTest` untouched and green (it pins the vector salt).
- Add one JVM test `PhoneHashVectorTest.test_IDT06_buildConfigSalt_matchesVectorDefault` asserting `BuildConfig.PHONE_HASH_SALT == PhoneHash.DEFAULT_SALT` — this is the tripwire that fails loudly if someone changes the deployment salt without realizing it breaks discovery interop with iOS/API (they must change all clients together).
- `scripts/e2e-android.sh` green (signup path exercises the salt end-to-end against the live API).

## Risks & gotchas

- Changing the effective salt value would silently break cross-platform contact discovery (same number hashing differently on iOS vs Android — rn-native-handoff.md:69) — this change must keep the VALUE identical everywhere and only move where it is configured.
- `internal` vs `@VisibleForTesting` for `resetForTests`: unit tests are in the same Gradle module, so `internal` works and needs no new annotation dependency — prefer it.
- Making `baseUrl` required is a compile-time-visible change only; no behavior change for the app (AppContainer already passes it).
