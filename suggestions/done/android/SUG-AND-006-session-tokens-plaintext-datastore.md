# SUG-AND-006 — "KeystoreTokenStore" stores JWTs in plain DataStore: name promises Keystore, code delivers none

- **Area:** android
- **Topic:** security
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** IDT-02

## Problem / Opportunity

/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/identity/KeystoreTokenStore.kt:12-24 writes the access AND refresh token as plaintext strings into the shared `DataStoreKeyValueStore` (`swab_kv` preferences file, DataStoreKeyValueStore.kt:9):

```kotlin
override suspend fun saveTokens(tokens: SessionTokens) {
    kv.set(ACCESS_KEY, tokens.accessToken)
    kv.set(REFRESH_KEY, tokens.refreshToken)
}
```

Problems:

- The class is named `KeystoreTokenStore` and `Session.kt:4-5` claims "Production storage is Keystore-backed" — neither is true. The header comment (KeystoreTokenStore.kt:6-11) is itself garbled mid-sentence ("kept behind the same envelope-encrypted [KeyValueStore] wiring as the vault blob is out of scope here"), evidence the intent got lost.
- The refresh token is a long-lived credential (IDT-02: "short-lived JWT access token + rotating refresh token"). On a rooted device or via a bad backup/extraction path, `swab_kv/…preferences_pb` yields account takeover. `android:allowBackup="false"` (AndroidManifest.xml:8) helps but is not encryption.
- The app already has exactly the right primitive: `AndroidKeystoreVaultKeyStore` (AndroidKeystoreVaultKeyStore.kt:35-98) does Keystore envelope encryption over the same `KeyValueStore`. Tokens deserve the same treatment (or at least an honest name + comment if a deliberate POC trade-off).

## Implementation plan

1. Extract the envelope-crypto core from `AndroidKeystoreVaultKeyStore` into a small reusable class `apps/android/app/src/main/kotlin/com/swab/android/security/KeystoreEnvelope.kt`:
   ```kotlin
   class KeystoreEnvelope(private val alias: String) {
       fun encrypt(plaintext: ByteArray): String  // base64(IV || CT||TAG), Keystore AES/GCM key under `alias`
       fun decrypt(blobBase64: String): ByteArray
   }
   ```
   Reuse the exact provider-quirk handling already proven there (no caller-supplied IV on ENCRYPT_MODE — AndroidKeystoreVaultKeyStore.kt:82-90; read `cipher.iv` back). Refactor `AndroidKeystoreVaultKeyStore` to delegate to it with alias `swab.vault.wrap.v1` (keep the alias and on-disk format byte-identical — existing installs must keep decrypting their wrapped vault key).
2. Rewrite `KeystoreTokenStore` to encrypt values with a second alias `swab.session.wrap.v1`:
   ```kotlin
   override suspend fun saveTokens(tokens: SessionTokens) {
       kv.set(ACCESS_KEY, envelope.encrypt(tokens.accessToken.encodeToByteArray()))
       kv.set(REFRESH_KEY, envelope.encrypt(tokens.refreshToken.encodeToByteArray()))
   }
   override suspend fun getAccessToken(): String? =
       kv.get(ACCESS_KEY)?.let { runCatching { envelope.decrypt(it).decodeToString() }.getOrNull() }
   ```
   A decrypt failure returns null (= logged out) — never crash.
3. Migration for existing installs: on `getAccessToken()`, if the stored value doesn't decrypt, treat as absent; users re-auth via OTP. Acceptable POC path — state it in the PR/CHANGELOG. (Do not attempt to detect "was plaintext" by JWT shape sniffing.)
4. Fix the misleading docs: rewrite the KeystoreTokenStore.kt:6-11 header and Session.kt:4-5 comment to describe the actual mechanism.
5. Keep `InMemorySecureTokenStore` (Session.kt:16-24) as the JVM fake; the envelope class is instrumented-only, mirroring the vault-key precedent (AndroidKeystoreVaultKeyStore.kt:31-33).
6. Add `getRefreshToken(): String?` to `SecureTokenStore` while here (needed by SUG-AND-007).
7. CHANGELOG entry (G5).

## Tests & acceptance criteria

- Instrumented (`androidTest`, runs inside `scripts/e2e-android.sh` via `connectedDebugAndroidTest`), new `KeystoreTokenStoreTest` beside AndroidKeystoreVaultKeyStoreTest.kt:
  - `test_IDT02_savedTokens_roundTripThroughKeystoreEnvelope`.
  - `test_IDT02_tokensAtRest_areNotPlaintext`: after `saveTokens`, read the raw kv values and assert they contain neither token substring.
  - `test_IDT02_undecryptableStoredToken_readsAsNull_notCrash` (write garbage under ACCESS_KEY first).
  - Regression: `AndroidKeystoreVaultKeyStoreTest` (existing 2 tests) must stay green after the refactor — same alias, same blob layout.
- JVM: `cd apps/android && ./gradlew test` unchanged/green.

## Risks & gotchas

- DO NOT change `swab.vault.wrap.v1` alias, the wrapped-vault-key kv key (`swab.vault.key.v1`), or its `IV || ciphertext+tag` layout — breaking that bricks every existing vault (VLT-01/VLT-05).
- Token envelope format is free to differ from the vault wire format (`IV‖TAG‖CT`, VaultCrypto.kt:21) — it's device-local, not cross-platform; keep it simple (`IV || CT+TAG`, matching the wrapped-key layout at AndroidKeystoreVaultKeyStore.kt:93-96).
- Two Cipher ops per request-header build (`accessTokenProvider`, AppContainer.kt:32 → ApiClient.headers() at ApiClient.kt:50-54) — negligible for four endpoints, but memoizing the decrypted access token in memory is fine if desired.
