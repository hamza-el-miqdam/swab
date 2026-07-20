# SUG-AND-010 — getOrCreateVaultKey has no lock: concurrent first calls can mint two different vault keys

- **Area:** android
- **Topic:** security
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** VLT-01, ONB-02

## Problem / Opportunity

`AndroidKeystoreVaultKeyStore.getOrCreateVaultKey` (/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/vault/AndroidKeystoreVaultKeyStore.kt:66-98) is check-then-act with no synchronization:

```kotlin
val wrapped = kv.get(VaultKeyStore.STORE_ID)   // check
...
val vaultKey = ByteArray(...); SecureRandom().nextBytes(vaultKey)  // act: new random key
...
kv.set(VaultKeyStore.STORE_ID, ...)            // persist wrapped key
return vaultKey
```

Two coroutines calling this concurrently before the first persist can BOTH see `wrapped == null`, generate two DIFFERENT 32-byte keys, and return them; only one wrapped blob survives the `kv.set` race. Any data encrypted with the losing key is permanently undecryptable (an `AEADBadTagException` on next hydrate — the crash-loop scenario of SUG-AND-004).

This is reachable today: `SignupViewModel.verifyOtp` calls `vaultKeyStore.getOrCreateVaultKey()` directly (SignupViewModel.kt:75) in its own `viewModelScope` coroutine, while `Vault.hydrate()`/`persist()` call it independently (Vault.kt:104, 111). The vault's own `Mutex` (Vault.kt:86) does not cover the key store, and the two paths run on different scopes. The same check-then-act shape exists in the wrap-key creation (`getOrCreateWrapKey`, AndroidKeystoreVaultKeyStore.kt:47-64 — two Keystore `generateKey` calls under the same alias, last-writer-wins, same divergence risk) and in the JVM fake `InMemoryVaultKeyStore` (VaultKeyStore.kt:31-44).

Low probability, catastrophic outcome (silent classification-data loss), trivial fix.

## Implementation plan

1. Add a `Mutex` to `AndroidKeystoreVaultKeyStore`:
   ```kotlin
   private val mutex = Mutex()
   override suspend fun getOrCreateVaultKey(): ByteArray = mutex.withLock {
       // existing body unchanged
   }
   ```
   (`kotlinx.coroutines.sync.Mutex` — already used in Vault.kt:4-5; no new dependency.)
2. Same `mutex.withLock` in `InMemoryVaultKeyStore.getOrCreateVaultKey` (VaultKeyStore.kt:34-43) so the JVM fake honestly models the contract.
3. Document the contract on the interface (VaultKeyStore.kt:22): add to the KDoc "Implementations MUST be safe under concurrent first-call; exactly one key may ever be minted per install."
4. `getOrCreateWrapKey` is now covered transitively (only called inside the locked body — AndroidKeystoreVaultKeyStore.kt:68); no separate lock needed.
5. CHANGELOG entry (G5).

## Tests & acceptance criteria

- JVM (`cd apps/android && ./gradlew test`), new `VaultKeyStoreConcurrencyTest`:
  - `test_VLT01_concurrentFirstCalls_returnTheSameKey`: with `InMemoryVaultKeyStore` (post-fix), launch 50 parallel `getOrCreateVaultKey()` via `runTest { (1..50).map { async { ... } }.awaitAll() }` and assert all returned arrays are content-equal.
  - To make the race deterministic pre/post-fix, inject a suspension point: simplest is a `DelayingKeyValueStore` wrapper (delay(10) inside `get`) around `InMemoryKeyValueStore` used by a test double of the keystore — or accept the statistical test above, which reliably fails on the unfixed in-memory fake under the multi-threaded `StandardTestDispatcher` variants.
- Instrumented: extend `AndroidKeystoreVaultKeyStoreTest` (AndroidKeystoreVaultKeyStoreTest.kt:40-49 precedent) with `test_VLT01_concurrentGetOrCreate_singleKeyPersisted`: two `async` calls on `Dispatchers.Default`, assert both results equal and equal to a third sequential call. Runs inside `scripts/e2e-android.sh` (`connectedDebugAndroidTest`).

## Risks & gotchas

- Hold the mutex across the whole read-unwrap-or-create-persist sequence — locking only the create branch reintroduces the race.
- Do not switch to `synchronized`: `kv.get`/`kv.set` are suspend functions (KeyValueStore.kt:15-16); a coroutine Mutex is the correct primitive.
- Zero behavior change on the happy path; existing on-disk wrapped keys and vector tests (VaultCryptoVectorTest, AndroidKeystoreVaultKeyStoreTest) must remain untouched and green.
