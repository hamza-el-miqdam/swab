# SUG-AND-016 — Release build ships unminified: R8 disabled, no shrinking, no ProGuard config in the tree

- **Area:** android
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** n/a (G1 hardening / build hygiene)

## Problem / Opportunity

/Users/mikedown/Workspace/Swab/apps/android/app/build.gradle.kts:47-50:

```kotlin
release {
    isMinifyEnabled = false
    buildConfigField("String", "API_BASE_URL", "\"https://api.swab.app\"")
}
```

No `proguardFiles(...)` line, no `isShrinkResources`, and the source tree contains no `proguard-rules.pro` (the audit file listing shows none under apps/android outside build/). Consequences for any distributed release APK:

- All Kotlin symbol names ship in cleartext — including `vault`, `VaultCrypto`, `AndroidKeystoreVaultKeyStore`, key alias constants — making reverse engineering of the privacy-critical client trivial. Obfuscation is not a security boundary, but for an app whose product promise is "nothing readable leaves the device", shipping a maximally readable binary is a gratuitous gift to attackers (G1 posture).
- No dead-code elimination or resource shrinking: Compose + Material3 + navigation unshrunk adds multiple MB of APK for a 4-endpoint app.
- The debug-vs-release seed-hook guarantee (E2ESeedHooks release no-op, verified "by disassembly" per CHANGELOG.md:15) is easier to keep re-verifying when release builds go through a deliberate, configured pipeline.

## Implementation plan

1. In `apps/android/app/build.gradle.kts` release block:
   ```kotlin
   release {
       isMinifyEnabled = true
       isShrinkResources = true
       proguardFiles(
           getDefaultProguardFile("proguard-android-optimize.txt"),
           "proguard-rules.pro",
       )
       buildConfigField("String", "API_BASE_URL", "\"https://api.swab.app\"")
   }
   ```
2. Create `apps/android/app/proguard-rules.pro`. Required keeps for this codebase:
   - kotlinx-serialization: the standard rules (keep `@Serializable` classes' generated `$serializer`, `kotlinx.serialization.internal.*` accessors). The serializable surface is small and enumerable: `VaultContact`, `VaultHistoryEvent`, `VaultData` (Vault.kt:21-68) and the ApiClient DTOs (ApiClient.kt:19-32). Use the official rules from the kotlinx.serialization README rather than hand-rolling.
   - Nothing needed for Compose/AGP defaults (consumer rules ship with the libraries).
   - No reflection is used elsewhere (manual DI, no Hilt — AppContainer.kt:18-22), so the keep surface stays tiny.
3. Verify the crypto wire format is untouched by minification: `VaultCrypto` uses no reflection and `java.util.Base64` — safe; the vector tests only run on debug-unit-test, so add the release smoke check below.
4. Smoke-verify: `./gradlew :app:assembleRelease` then install the release APK on the emulator and run the app manually to Carte (release build has no seed hooks or instrumentation — a manual launch check is the honest gate; record it in the PR). Optionally add `./gradlew :app:testReleaseUnitTest` to CI for the JVM suite against release-compiled classes (the 216-test suite already runs on both variants per CHANGELOG.md:10 — keep that true after minify config).
5. Re-verify the E2ESeedHooks release no-op claim post-R8 (disassemble or `apkanalyzer dex packages` and confirm the debug seed path is absent — it should be, it was never compiled in; R8 doesn't change that but the check is cheap).
6. CHANGELOG entry (G5) with the keep-rules rationale.

## Tests & acceptance criteria

- `cd apps/android && ./gradlew :app:assembleRelease` succeeds; `apkanalyzer` (or Studio APK viewer) shows obfuscated names outside the keep list and a smaller APK than before (record before/after sizes in the PR).
- Manual release-APK launch → onboarding Welcome renders; complete a signup against a staging API if available, else at minimum confirm no `SerializationException`/crash at first screen (missing serializer keeps fail fast at first JSON use — exercise the OTP request path).
- Debug behavior unchanged: `./gradlew test` and `scripts/e2e-android.sh` all green (minification applies to release only).

## Risks & gotchas

- kotlinx-serialization is THE breakage risk: a missing keep rule fails at runtime, not compile time — always exercise one serialize + one deserialize path on the release APK before shipping.
- Do not enable minification for the debug/androidTest variants (would slow the E2E loop and change coverage class paths used by jacoco, build.gradle.kts:181).
- `isShrinkResources` requires `isMinifyEnabled`; keep them toggled together.
- Mapping files: R8 writes `build/outputs/mapping/release/mapping.txt` — note in the PR where it lands so future crash symbolication (SUG-AND-012's reporter) can use it.
