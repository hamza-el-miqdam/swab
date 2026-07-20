# SUG-AND-004 — A corrupt blob or lost Keystore key crashes the app at launch: no failure path anywhere in vault hydration

- **Area:** android
- **Topic:** correctness
- **Impact:** high
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** VLT-01, VLT-05, MAP-05

## Problem / Opportunity

`Vault.hydrate()` (/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/vault/Vault.kt:91-108) does:

```kotlin
val decoded = json.decodeFromString<VaultData>(VaultCrypto.decrypt(blob, key))
```

with zero error handling. Every failure mode is an uncaught exception:

- `VaultCrypto.decrypt` (VaultCrypto.kt:61-80) throws `AEADBadTagException` on any tampered/corrupt blob, and `IllegalArgumentException`/`ArrayIndexOutOfBoundsException` from `Base64.getDecoder().decode` / `copyOfRange` on a truncated blob (< 28 bytes).
- `AndroidKeystoreVaultKeyStore.getOrCreateVaultKey` (AndroidKeystoreVaultKeyStore.kt:66-98) throws if the Keystore wrap key was invalidated (OS upgrade, keystore reset, backup restore to a new device) while the wrapped-key blob is still in DataStore — `cipher.doFinal` at line 76 fails, unrecoverably, on every subsequent launch.
- `json.decodeFromString` throws `SerializationException` on malformed plaintext.

Every caller reads the vault inside `viewModelScope.launch` with no try/catch — e.g. `CarteViewModel.refresh()` (CarteViewModel.kt:47-49), `FicheViewModel.refresh()` (FicheViewModel.kt:54-63), `ContactsViewModel.refresh()` (ContactsViewModel.kt:28-30). An exception in a `viewModelScope` coroutine with no CoroutineExceptionHandler crashes the process. Result: one corrupt byte on disk = permanent crash loop at app start (the Carte is the start destination and hydrates immediately). MAP-05's "map renders fully offline" promise fails in the worst possible way, and the user is never shown the honest VLT-05 message ("losing the key loses the data").

## Implementation plan

1. Define a result type in Vault.kt:
   ```kotlin
   sealed interface VaultLoadState {
       data object Ok : VaultLoadState
       /** Blob exists but cannot be decrypted/decoded — VLT-05 honest-loss state. */
       data object Unreadable : VaultLoadState
   }
   ```
2. In `Vault`, wrap the decrypt+decode in `hydrate()` in a try/catch of `Exception`. On failure: set a private `loadState = Unreadable`, keep `cache = VaultData()` (empty, in-memory only — do NOT overwrite the on-disk blob, the user may recover it via a future fix or the server copy), and expose `suspend fun loadState(): VaultLoadState` (hydrates first). Never rethrow to callers.
3. Do NOT auto-persist while `Unreadable`: guard `persist()` to throw `IllegalStateException` (or no-op with the state kept) so a fresh empty vault can't silently clobber the blob and `getEncryptedVault()` (Vault.kt:192-201) can't push garbage over the server's good copy. Simplest honest behavior: writes are rejected while unreadable.
4. Surface it calmly in the UI: `CarteViewModel` gains `val vaultUnreadable: StateFlow<Boolean>` set in `refresh()`; `CarteScreen` shows a quiet body-text line when true. New French copy is required — per the copy rule (Fr.kt:12-14, "Copy changes come from the specs only") the exact string must go through the spec/product owner first; open the issue and stop if not provided (G4). A placeholder marked `⚠️ ASSUMPTION` in `Fr.kt` mirroring the FICHE_STALE_TITLE precedent (Fr.kt:101-103) is acceptable if the PR flags it.
5. Also catch in `getOrCreateVaultKey` callers? No — keep KeyStore failures flowing into the same try/catch in `hydrate()`/`persist()` (they call `keyStore.getOrCreateVaultKey()` at Vault.kt:104/111, inside the new guard).
6. CHANGELOG entry (G5); note the deliberate decision NOT to auto-wipe.

## Tests & acceptance criteria

New JVM tests in `apps/android/app/src/test/kotlin/com/swab/android/vault/VaultCorruptionTest.kt` (`./gradlew test`):

- `test_VLT05_truncatedBlob_yieldsUnreadableState_notCrash`: put `"vault.blob.v1" -> "AAAA"` in an `InMemoryKeyValueStore`, assert `getContacts()` returns empty and `loadState()` is `Unreadable`.
- `test_VLT05_wrongKey_tamperedBlob_yieldsUnreadable`: encrypt VaultData with one `InMemoryVaultKeyStore`, hydrate with a different one.
- `test_VLT05_unreadableVault_neverOverwritesBlobOnDisk`: after the above, attempt `addContact`, then assert `kv.get("vault.blob.v1")` is byte-identical to the seeded value and `getEncryptedVault` did not push a fresh empty blob.
- `test_VLT01_healthyBlob_stateOk_roundTripUnchanged` (regression guard for the happy path).
- E2E: optionally extend `LegacyVaultCompatE2ETest` with a corrupt-blob variant of the seed hook (new Intent extra writing garbage to `vault.blob.v1`) asserting the app reaches Carte without crashing; run `scripts/e2e-android.sh`.

## Risks & gotchas

- Never log the blob, key, or plaintext in the failure path (G3 "never log vault contents") — log only an event name, no payload.
- The rejected-writes-while-unreadable choice must be visible to the user (the calm message), or the app looks broken; nothing may be hidden silently (G4 product ethos).
- Preserve the existing behavior that a *missing* blob (first run) is a normal empty vault (Vault.kt:99-103) — only decrypt/decode failures map to `Unreadable`.
- Coordinate copy with the spec-specialist; do not invent final French strings (CLAUDE.md hard boundary).
