package com.swab.android.vault

import com.swab.android.security.KeystoreEnvelope
import com.swab.android.storage.KeyValueStore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.security.SecureRandom

/**
 * Production [VaultKeyStore]: envelope encryption via the Android Keystore
 * (android-specialist.md rule 1 — never plain SharedPreferences).
 *
 * The 32-byte vault key itself must stay a portable raw AES key (it is used
 * directly with [VaultCrypto], which must reproduce the cross-platform
 * vector blobs byte-for-byte — an Android Keystore key handle cannot be
 * exported as raw bytes, so it cannot BE the vault key). Instead:
 *  1. A non-exportable AES-256-GCM "wrapping key" lives in the Android
 *     Keystore under alias `swab.vault.wrap.v1`.
 *  2. The actual 32-byte vault key is generated once with [SecureRandom],
 *     then wrapped with that key and persisted as an opaque blob via [kv]
 *     under [VaultKeyStore.STORE_ID].
 *  3. On every app start the wrapped blob is unwrapped using the Keystore
 *     key (which never leaves secure hardware) to recover the raw vault key.
 *
 * The envelope crypto itself lives in [KeystoreEnvelope] (extracted by
 * SUG-AND-006 so session tokens reuse this exact implementation). The alias
 * and the on-disk `IV ‖ CT ‖ TAG` layout are unchanged by that extraction —
 * existing installs must keep decrypting their wrapped vault key.
 *
 * **Failure behaviour is deliberate:** unwrapping throws when the blob is
 * corrupt or the Keystore key is gone. `Vault.hydrate()`/`persist()` catch
 * it and surface `VaultLoadState.Unreadable` (SUG-AND-004) — do not swallow
 * it here, or that honest state silently becomes an empty vault.
 *
 * NOTE: requires a real Android Keystore provider, so it is not exercised by
 * JVM unit tests (see InMemoryVaultKeyStore for that seam) —
 * `AndroidKeystoreVaultKeyStoreTest` in androidTest covers it.
 */
class AndroidKeystoreVaultKeyStore(private val kv: KeyValueStore) : VaultKeyStore {
    companion object {
        private const val WRAP_KEY_ALIAS = "swab.vault.wrap.v1"
    }

    private val envelope = KeystoreEnvelope(WRAP_KEY_ALIAS)
    private val mutex = Mutex()

    // SUG-AND-010: check-then-act, so it must run under a lock — two
    // concurrent first calls (SignupViewModel's own scope racing
    // Vault.hydrate()/persist()) could otherwise both see no wrapped key,
    // mint two different ones, and silently strand whichever loses the
    // kv.set race (SUG-AND-004's crash loop). This is the sole caller that
    // ever touches WRAP_KEY_ALIAS, so KeystoreEnvelope.getOrCreateKey()'s own
    // check-then-act on that alias is covered transitively — it only runs
    // inside this locked body.
    override suspend fun getOrCreateVaultKey(): ByteArray = mutex.withLock {
        val wrapped = kv.get(VaultKeyStore.STORE_ID)
        if (wrapped != null) return@withLock envelope.decrypt(wrapped)

        val vaultKey = ByteArray(VaultKeyStore.KEY_LENGTH_BYTES)
        SecureRandom().nextBytes(vaultKey)
        kv.set(VaultKeyStore.STORE_ID, envelope.encrypt(vaultKey))
        vaultKey
    }
}
