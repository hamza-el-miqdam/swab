package com.swab.android.vault

import com.swab.android.storage.KeyValueStore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The on-device vault (android-specialist.md rules 1/3/6, FS-07 VLT-01).
 * Port of apps/mobile/src/vault/vault.ts.
 *
 * All four classification axes live HERE and only here: intimité (ring),
 * rôles, état, ressenti. In memory while the app runs; at rest as an
 * AES-256-GCM blob via [KeyValueStore]. Nothing in this class talks to the
 * network — VaultSync ships the ciphertext, never the fields.
 *
 * VLT-01 / android rule 6: accessors return fresh immutable copies, never
 * live references into the internal mutable cache.
 */
@Serializable
data class VaultContact(
    val id: String,
    val displayName: String,
    /** Client-side hash (IDT-06); stays local until FS-07 discovery runs. */
    val phoneHash: String? = null,
    /** Intimité — 1 = innermost ring. Unset until calibrated (ONB-04). */
    val ring: Int? = null,
    val roles: List<String> = emptyList(),
    val etat: String? = null,
    val ressenti: String? = null,
)

@Serializable
data class VaultData(val contacts: List<VaultContact> = emptyList())

data class EncryptedVaultBlob(val blob: String, val version: Int)

class Vault(
    private val kv: KeyValueStore,
    private val keyStore: VaultKeyStore,
    private val idGenerator: () -> String = { java.util.UUID.randomUUID().toString() },
) {
    companion object {
        private const val BLOB_KEY = "vault.blob.v1"
        private const val VERSION_KEY = "vault.version.v1"
    }

    private val json = Json { ignoreUnknownKeys = true } // shape grows with FS-03/04/06
    private val mutex = Mutex()

    private var cache: VaultData? = null
    private var version: Int = 1

    private suspend fun hydrate(): VaultData {
        val cached = cache
        if (cached != null) return cached

        val blob = kv.get(BLOB_KEY)
        val storedVersion = kv.get(VERSION_KEY)
        version = storedVersion?.toIntOrNull() ?: 1

        if (blob == null) {
            val fresh = VaultData()
            cache = fresh
            return fresh
        }
        val key = keyStore.getOrCreateVaultKey()
        val decoded = json.decodeFromString<VaultData>(VaultCrypto.decrypt(blob, key))
        cache = decoded
        return decoded
    }

    private suspend fun persist(data: VaultData) {
        val key = keyStore.getOrCreateVaultKey()
        version += 1
        kv.set(BLOB_KEY, VaultCrypto.encrypt(json.encodeToString(VaultData.serializer(), data), key))
        kv.set(VERSION_KEY, version.toString())
    }

    /** Fresh copy — never a live reference into the cache. */
    suspend fun getContacts(): List<VaultContact> = mutex.withLock {
        hydrate().contacts.map { it.copy() }
    }

    suspend fun addContact(displayName: String, phoneHash: String? = null): VaultContact =
        mutex.withLock {
            val data = hydrate()
            val contact = VaultContact(id = idGenerator(), displayName = displayName, phoneHash = phoneHash)
            val next = data.copy(contacts = data.contacts + contact)
            cache = next
            persist(next)
            contact
        }

    private suspend fun mutateContact(id: String, mutate: (VaultContact) -> VaultContact) {
        mutex.withLock {
            val data = hydrate()
            val index = data.contacts.indexOfFirst { it.id == id }
            if (index < 0) return@withLock
            val updated = data.contacts.toMutableList()
            updated[index] = mutate(updated[index])
            val next = data.copy(contacts = updated)
            cache = next
            persist(next)
        }
    }

    suspend fun setRing(id: String, ring: Int) {
        require(ring in 1..4) { "ring must be 1..4" }
        mutateContact(id) { it.copy(ring = ring) }
    }

    suspend fun setEtat(id: String, etat: String?) = mutateContact(id) { it.copy(etat = etat) }

    suspend fun setRessenti(id: String, ressenti: String?) =
        mutateContact(id) { it.copy(ressenti = ressenti) }

    /** Ciphertext + version for VaultSync — the only exit door. */
    suspend fun getEncryptedVault(): EncryptedVaultBlob = mutex.withLock {
        val data = hydrate()
        var blob = kv.get(BLOB_KEY)
        if (blob == null) {
            persist(data)
            blob = kv.get(BLOB_KEY)
        }
        checkNotNull(blob) { "vault blob unavailable" }
        EncryptedVaultBlob(blob, version)
    }

    suspend fun setVaultVersion(next: Int) = mutex.withLock {
        version = next
        kv.set(VERSION_KEY, next.toString())
    }

    /** Test seam: drops in-memory state, simulating a process restart. */
    fun resetForTests() {
        cache = null
        version = 1
    }
}
