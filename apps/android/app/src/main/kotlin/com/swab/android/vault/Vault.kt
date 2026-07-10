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
    /**
     * Mirrors FS-07's `ContactLink.targetId` (IDT-07): null while this person
     * hasn't joined swab yet. ASSUMPTION: defaults to null for every contact
     * because contact discovery (IDT-06) has no Android client yet — until
     * that lands, the fiche's envie-eligibility indicator (FCH-08) is
     * legitimately "inactive" for everyone, which is the honest state today,
     * not a placeholder guess.
     */
    val targetId: String? = null,
    /** FCH-05 — epoch millis of the most recent axis edit; null = never edited. */
    val lastAxisChangeAt: Long? = null,
    /** FCH-05 — epoch millis until which the staleness nudge stays suppressed after « À revoir plus tard ». */
    val staleSnoozedUntil: Long? = null,
)

/**
 * FS-03 FCH-04 — one entry in a contact's local history feed (axis edits;
 * relation events like matches are a reserved future case via [axis] = null,
 * once FS-04/05 exist to source them). Lives inside the same encrypted
 * [VaultData] blob as everything else — never sent to the network except as
 * opaque ciphertext (FCH acceptance criterion / G1).
 */
@Serializable
data class VaultHistoryEvent(
    val id: String,
    val contactId: String,
    /** "intimite" | "roles" | "etat" | "ressenti" | null (reserved for future relation events). */
    val axis: String? = null,
    val summary: String,
    val at: Long,
)

@Serializable
data class VaultData(
    val contacts: List<VaultContact> = emptyList(),
    val history: List<VaultHistoryEvent> = emptyList(),
)

data class EncryptedVaultBlob(val blob: String, val version: Int)

class Vault(
    private val kv: KeyValueStore,
    private val keyStore: VaultKeyStore,
    private val idGenerator: () -> String = { java.util.UUID.randomUUID().toString() },
) {
    companion object {
        private const val BLOB_KEY = "vault.blob.v1"
        private const val VERSION_KEY = "vault.version.v1"

        /** FCH-05 « À revoir plus tard » re-eligibility window — 30 days, per spec. */
        const val SNOOZE_MILLIS: Long = 30L * 24 * 60 * 60 * 1000
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

    suspend fun setRoles(id: String, roles: List<String>) = mutateContact(id) { it.copy(roles = roles) }

    /**
     * FCH-01 — records one axis edit as a local history event and stamps
     * [VaultContact.lastAxisChangeAt], resetting any active staleness snooze
     * (a fresh edit is itself a re-confirmation). Atomic with the history
     * append: both mutate the same [VaultData] under one lock acquisition, so
     * [mutateContact] (which takes its own lock) can't be reused here.
     */
    suspend fun recordAxisEdit(contactId: String, axis: String, summary: String, at: Long) {
        mutex.withLock {
            val data = hydrate()
            val index = data.contacts.indexOfFirst { it.id == contactId }
            if (index < 0) return@withLock
            val updatedContacts = data.contacts.toMutableList()
            updatedContacts[index] = updatedContacts[index].copy(lastAxisChangeAt = at, staleSnoozedUntil = null)
            val event = VaultHistoryEvent(id = idGenerator(), contactId = contactId, axis = axis, summary = summary, at = at)
            val next = data.copy(contacts = updatedContacts, history = data.history + event)
            cache = next
            persist(next)
        }
    }

    /** FCH-04 — newest first; callers apply the 12-month window. */
    suspend fun getHistory(contactId: String): List<VaultHistoryEvent> = mutex.withLock {
        hydrate().history.filter { it.contactId == contactId }.sortedByDescending { it.at }.map { it.copy() }
    }

    /** FCH-05 « C'est toujours ça » — resets the staleness timer, clears any snooze. */
    suspend fun confirmStillAccurate(contactId: String, at: Long) =
        mutateContact(contactId) { it.copy(lastAxisChangeAt = at, staleSnoozedUntil = null) }

    /** FCH-05 « À revoir plus tard » — quietly suppresses the nudge for [SNOOZE_MILLIS]; nothing logged server-side. */
    suspend fun snoozeStaleness(contactId: String, at: Long) =
        mutateContact(contactId) { it.copy(staleSnoozedUntil = at + SNOOZE_MILLIS) }

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
