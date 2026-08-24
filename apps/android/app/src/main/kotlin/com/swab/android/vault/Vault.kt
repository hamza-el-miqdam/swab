package com.swab.android.vault

import com.swab.android.fiche.Etat
import com.swab.android.fiche.Ressenti
import com.swab.android.fiche.RoleContexte
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
) {
    // FCH-09 typed reads. [etat]/[ressenti]/[roles] hold the STORED tokens
    // (identifiers, or an unrecognised token preserved verbatim). Everything
    // that renders or branches on a value goes through these instead, so no
    // call site ever compares against French copy again. Not constructor
    // properties, so kotlinx.serialization ignores them.

    val etatValue: Etat? get() = Etat.parse(etat)

    val ressentiValue: Ressenti? get() = Ressenti.parse(ressenti)

    /** Unrecognised tokens are skipped for display but remain in [roles]. */
    val roleValues: List<RoleContexte> get() = roles.mapNotNull { RoleContexte.parse(it) }
}

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

/**
 * VLT-05 — whether the last hydration attempt could make sense of the
 * on-disk blob. [Unreadable] covers a tampered/truncated blob, a wrong or
 * lost Keystore key, and malformed plaintext alike (SUG-AND-004): the app
 * must never crash on any of these, only report the honest "can't read
 * this" state.
 */
sealed interface VaultLoadState {
    data object Ok : VaultLoadState
    data object Unreadable : VaultLoadState
}

class Vault(
    private val kv: KeyValueStore,
    private val keyStore: VaultKeyStore,
    private val idGenerator: () -> String = { java.util.UUID.randomUUID().toString() },
    /**
     * VLT-10 (SUG-AND-001) — fired after every write that actually reached
     * disk, so a scheduler can debounce a burst into one sync. A callback,
     * not a collaborator: THIS CLASS must never import the network or sync
     * layers (SyncTriggerWiringStructuralTest / FicheOfflineStructuralTest) —
     * `VaultSync`, its neighbour in this package, necessarily does — and the
     * vault stays usable with no listener at all.
     */
    private val onPersist: () -> Unit = {},
) {
    companion object {
        private const val BLOB_KEY = "vault.blob.v1"
        private const val VERSION_KEY = "vault.version.v1"

        /** FCH-05 « À revoir plus tard » re-eligibility window — 30 days, per spec. */
        const val SNOOZE_MILLIS: Long = 30L * 24 * 60 * 60 * 1000

        /**
         * FCH-04 retention window — the history feed is defined as
         * "over 12 months, newest first" (FS-03), so anything older is not
         * product surface and is dropped at write time rather than kept
         * forever against the 1 MB per-user vault cap (SUG-AND-013) —
         * enforced by `MAX_VAULT_BYTES` in `apps/api/src/routes/vault.ts`
         * and a DB CHECK, not by a current FS-07 requirement ID.
         * [FicheViewModel] filters by this same constant at read time; the
         * two must not drift.
         */
        const val HISTORY_RETENTION_MILLIS: Long = 365L * 24 * 60 * 60 * 1000
    }

    private val json = Json { ignoreUnknownKeys = true } // shape grows with FS-03/04/06
    private val mutex = Mutex()

    private var cache: VaultData? = null
    private var version: Int = 1
    private var loadState: VaultLoadState = VaultLoadState.Ok

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
        // VLT-05 / SUG-AND-004: a tampered/truncated blob (AEADBadTagException,
        // IllegalArgumentException/ArrayIndexOutOfBoundsException from a short
        // payload), a lost/invalidated Keystore key, or malformed plaintext
        // (SerializationException) must never crash the app — surface an
        // honest Unreadable state instead. Keep the empty result in-memory
        // only; the on-disk blob is left untouched so a future fix (or the
        // server's copy) can still recover it.
        return try {
            val key = keyStore.getOrCreateVaultKey()
            val decoded = json.decodeFromString<VaultData>(VaultCrypto.decrypt(blob, key))
                .normalizedForFch09()
            loadState = VaultLoadState.Ok
            cache = decoded
            decoded
        } catch (e: Exception) {
            loadState = VaultLoadState.Unreadable
            val fresh = VaultData()
            cache = fresh
            fresh
        }
    }

    /** VLT-05 — hydrates first, then reports whether the on-disk blob could be read. */
    suspend fun loadState(): VaultLoadState = mutex.withLock {
        hydrate()
        loadState
    }

    /**
     * [notify] = false for writes that are bookkeeping rather than user
     * intent. `getEncryptedVault()` materialises a blob when none exists yet,
     * and that happens INSIDE a sync — notifying there re-arms the debounce
     * the sync was serving, so a read-only sync scheduled another sync.
     */
    private suspend fun persist(data: VaultData, notify: Boolean = true) {
        // SUG-AND-004: writes are rejected while the vault is Unreadable — a
        // fresh empty vault must never silently clobber a corrupt-but-maybe-
        // recoverable blob, nor push garbage over the server's good copy.
        if (loadState == VaultLoadState.Unreadable) return
        val written = try {
            val key = keyStore.getOrCreateVaultKey()
            version += 1
            kv.set(BLOB_KEY, VaultCrypto.encrypt(json.encodeToString(VaultData.serializer(), data), key))
            kv.set(VERSION_KEY, version.toString())
            true
        } catch (e: Exception) {
            // A previously-healthy vault whose Keystore key just became
            // unusable (OS upgrade, keystore reset) — same honest state,
            // never a crash.
            loadState = VaultLoadState.Unreadable
            false
        }
        // VLT-10: only once the bytes are actually down, never on the
        // Unreadable early-return above (an unreadable vault must not push
        // its empty in-memory state over the server's good copy —
        // SUG-AND-004), and outside the try so a listener that throws is not
        // mistaken for a failed write.
        if (written && notify) onPersist()
    }

    /**
     * FCH-09 dual-read, applied once at the single hydration point. A blob
     * written before 2026-08-16 carries French display copy ("occupé"), a
     * newer one carries identifiers ("busy"); both decode, and the next
     * persist writes identifiers. A token in neither vocabulary — e.g. the
     * retired `douceur` in `vault-test-vectors.json` — is kept verbatim, so
     * nothing is ever dropped by a read.
     */
    private fun VaultData.normalizedForFch09(): VaultData = copy(
        contacts = contacts.map { contact ->
            contact.copy(
                roles = contact.roles.map { RoleContexte.normalize(it) },
                etat = contact.etat?.let { Etat.normalize(it) },
                ressenti = contact.ressenti?.let { Ressenti.normalize(it) },
            )
        },
    )

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

    // FCH-09: the setters take the typed value, not a String, so writing
    // French copy into the vault is a compile error rather than a review catch.

    suspend fun setEtat(id: String, etat: Etat?) = mutateContact(id) { it.copy(etat = etat?.id) }

    suspend fun setRessenti(id: String, ressenti: Ressenti?) =
        mutateContact(id) { it.copy(ressenti = ressenti?.id) }

    suspend fun setRoles(id: String, roles: List<RoleContexte>) =
        mutateContact(id) { it.copy(roles = roles.map { role -> role.id }) }

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
            // SUG-AND-013 / FCH-04 — prune inside the same lock + single
            // persist as the append, so the blob never holds more than
            // FCH-04's 12-month window. This is the vault's ONLY history
            // append path, so append-time pruning bounds growth without a
            // background job. The prune is blob-wide, not per contact: the
            // cap is on the blob and FCH-04 shows nothing out of window for
            // any contact anyway.
            //
            // `at` is the caller's clock seam (never System.currentTimeMillis()
            // in here), which keeps this deterministic — but a clock seam is
            // still a clock, and a device whose clock runs years fast would
            // otherwise compute a cutoff in the FUTURE and delete every real
            // event. That is not a display glitch: persist() writes it
            // immediately and VaultSync pushes the whole blob (re-pushing it
            // unmerged on 409), so the deletion reaches the server, which is
            // the VLT-05 restore source. Hiding history on a bad clock is
            // survivable; destroying it is not.
            //
            // So `at` is corroborated against the newest timestamp already
            // stored: real events are evidence that real time passed. If the
            // caller's clock is further ahead of that than the whole retention
            // window, we cannot tell a clock jump from a long dormancy — and
            // in that doubt we append without deleting. Growth stays bounded
            // regardless: blobs grow through FREQUENT edits, and frequent
            // edits keep `newest` recent, which keeps the guard satisfied.
            // A deferred prune costs one write; a wrong prune costs the data.
            //
            // Future: when contact deletion lands, it must prune that
            // contact's history rows here too.
            val newest = data.history.maxOfOrNull { it.at }
            val clockIsCorroborated = newest == null || at - newest <= HISTORY_RETENTION_MILLIS
            val retained = if (clockIsCorroborated) {
                data.history.filter { it.at >= at - HISTORY_RETENTION_MILLIS }
            } else {
                data.history
            }
            val next = data.copy(contacts = updatedContacts, history = retained + event)
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
            // notify = false: this write is the sync's own doing (see persist).
            persist(data, notify = false)
            blob = kv.get(BLOB_KEY)
        }
        checkNotNull(blob) { "vault blob unavailable" }
        EncryptedVaultBlob(blob, version)
    }

    suspend fun setVaultVersion(next: Int) = mutex.withLock {
        version = next
        kv.set(VERSION_KEY, next.toString())
    }

    /**
     * Test seam: drops in-memory state, simulating a process restart.
     * SUG-AND-018: `internal` (not a public method on this production class)
     * — unit tests live in the same Gradle module, so visibility still
     * works, with no new `@VisibleForTesting` dependency needed.
     */
    internal fun resetForTests() {
        cache = null
        version = 1
    }
}
