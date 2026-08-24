package com.swab.android.vault

import com.swab.android.fiche.Etat
import com.swab.android.fiche.Ressenti
import com.swab.android.fiche.RoleContexte
import com.swab.android.storage.InMemoryKeyValueStore
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VaultTest {

    private fun newVault(
        kv: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        keyStore: VaultKeyStore = InMemoryVaultKeyStore(),
    ) = Vault(kv, keyStore, idGenerator = { "fixed-id" })

    @Test
    fun `VLT-01 getContacts returns a fresh copy, not a live reference`() = runTest {
        val vault = newVault()
        vault.addContact("Léïla")
        val first = vault.getContacts()
        val second = vault.getContacts()
        assertNotSame("must not return the same list instance twice", first, second)
        assertEquals(first, second)
    }

    @Test
    fun `VLT-01 addContact then getContacts round-trips displayName and phoneHash`() = runTest {
        val vault = newVault()
        vault.addContact(displayName = "Amine", phoneHash = "abc123")
        val contacts = vault.getContacts()
        assertEquals(1, contacts.size)
        assertEquals("Amine", contacts.first().displayName)
        assertEquals("abc123", contacts.first().phoneHash)
        assertNull(contacts.first().ring)
    }

    @Test
    fun `ONB-04 setRing persists the chosen intimacy ring`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Sami")
        vault.setRing(contact.id, 2)
        assertEquals(2, vault.getContacts().first().ring)
    }

    @Test
    fun `setRing rejects rings outside 1 to 4`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Sami")
        try {
            vault.setRing(contact.id, 5)
            assertTrue("expected an exception for an out-of-range ring", false)
        } catch (_: IllegalArgumentException) {
            // expected
        }
    }

    @Test
    fun `ONB-06 setEtat and setRessenti persist and can be cleared`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Nadia")
        vault.setEtat(contact.id, Etat.AVAILABLE)
        vault.setRessenti(contact.id, Ressenti.POSITIVE)
        var loaded = vault.getContacts().first()
        // FCH-09: identifiers persist, and the typed reads resolve them.
        assertEquals("available", loaded.etat)
        assertEquals("positive", loaded.ressenti)
        assertEquals(Etat.AVAILABLE, loaded.etatValue)
        assertEquals(Ressenti.POSITIVE, loaded.ressentiValue)

        vault.setEtat(contact.id, null)
        loaded = vault.getContacts().first()
        assertNull(loaded.etat)
    }

    @Test
    fun `version starts at 1 and increments on every persist`() = runTest {
        val vault = newVault()
        // First getEncryptedVault() call triggers the lazy first persist: 1 -> 2.
        assertEquals(2, vault.getEncryptedVault().version)
        vault.addContact("A")
        val afterOne = vault.getEncryptedVault().version
        vault.addContact("B")
        val afterTwo = vault.getEncryptedVault().version
        assertTrue("version must increase monotonically", afterTwo > afterOne)
    }

    @Test
    fun `restart (resetForTests) resumes from the persisted encrypted blob`() = runTest {
        val kv = InMemoryKeyValueStore()
        val keyStore = InMemoryVaultKeyStore()
        val vault = Vault(kv, keyStore, idGenerator = { "fixed-id" })
        vault.addContact("Persisted Person")

        val resumed = Vault(kv, keyStore, idGenerator = { "fixed-id" })
        val contacts = resumed.getContacts()
        assertEquals(1, contacts.size)
        assertEquals("Persisted Person", contacts.first().displayName)
    }

    @Test
    fun `getEncryptedVault never exposes plaintext, only an opaque blob`() = runTest {
        val vault = newVault()
        vault.addContact("Secret Name")
        val encrypted = vault.getEncryptedVault()
        assertTrue(!encrypted.blob.contains("Secret Name"))
    }

    @Test
    fun `FCH-01 setRoles persists the chosen roles`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Sami")
        vault.setRoles(contact.id, listOf(RoleContexte.FAMILY, RoleContexte.COLLEAGUE))
        assertEquals(listOf("family", "colleague"), vault.getContacts().first().roles)
        assertEquals(
            listOf(RoleContexte.FAMILY, RoleContexte.COLLEAGUE),
            vault.getContacts().first().roleValues,
        )
    }

    @Test
    fun `FCH-01 recordAxisEdit stamps lastAxisChangeAt and appends a history event, clearing any snooze`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Sami")
        vault.snoozeStaleness(contact.id, at = 500L)
        assertEquals(500L + Vault.SNOOZE_MILLIS, vault.getContacts().first().staleSnoozedUntil)

        vault.recordAxisEdit(contact.id, axis = "etat", summary = "État → disponible", at = 1_000L)

        val updated = vault.getContacts().first()
        assertEquals(1_000L, updated.lastAxisChangeAt)
        assertNull("a fresh edit clears any active snooze", updated.staleSnoozedUntil)

        val history = vault.getHistory(contact.id)
        assertEquals(1, history.size)
        assertEquals("etat", history.first().axis)
        assertEquals("État → disponible", history.first().summary)
        assertEquals(1_000L, history.first().at)
    }

    @Test
    fun `FCH-04 getHistory returns newest first and only for the requested contact`() = runTest {
        // Real (non-fixed) id generator: newVault()'s fixed "fixed-id" would
        // collide both contacts onto the same id, which is exactly what this
        // test needs to distinguish.
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val a = vault.addContact("A")
        val b = vault.addContact("B")
        vault.recordAxisEdit(a.id, axis = "etat", summary = "first", at = 1L)
        vault.recordAxisEdit(a.id, axis = "ressenti", summary = "second", at = 2L)
        vault.recordAxisEdit(b.id, axis = "etat", summary = "other contact", at = 3L)

        val history = vault.getHistory(a.id)
        assertEquals(2, history.size)
        assertEquals("second", history.first().summary)
        assertEquals("first", history[1].summary)
    }

    // ---- SUG-AND-013 / FCH-04: history is pruned at write time ----------
    //
    // FCH-04's 12-month window used to be applied only at read time
    // (FicheViewModel.refresh), so the stored list grew forever against
    // the 1 MB per-user vault cap. Pruning happens inside
    // recordAxisEdit — the vault's only history-append path — using the
    // caller-supplied `at` as "now", so these stay deterministic.

    @Test
    fun `FCH-04 recordAxisEdit prunes events older than 12 months`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Nadia")
        // Edits at a realistic cadence (~6 months apart). Deliberately NOT one
        // 13-month jump: that is indistinguishable from a clock jump, and the
        // skew guard correctly declines to delete on it — see the fast-clock
        // regression tests below.
        val halfWindow = Vault.HISTORY_RETENTION_MILLIS / 2
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "oldest", at = 0L)
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "second", at = halfWindow)
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "third", at = Vault.HISTORY_RETENTION_MILLIS)

        vault.recordAxisEdit(contact.id, axis = "ressenti", summary = "newest", at = Vault.HISTORY_RETENTION_MILLIS + halfWindow)

        val summaries = vault.getHistory(contact.id).map { it.summary }
        assertTrue("the out-of-window event must be dropped by the write: got $summaries", !summaries.contains("oldest"))
        assertEquals(listOf("newest", "third", "second"), summaries)
    }

    @Test
    fun `FCH-04 events inside the 12-month window are never pruned`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Nadia")
        // Sits exactly ON the cutoff of the write below — the retention
        // boundary is inclusive, so `>` instead of `>=` fails here.
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "oldest kept", at = 1_000L)

        vault.recordAxisEdit(
            contact.id,
            axis = "ressenti",
            summary = "newest",
            at = Vault.HISTORY_RETENTION_MILLIS + 1_000L,
        )

        val history = vault.getHistory(contact.id)
        assertEquals(2, history.size)
        assertEquals("newest", history.first().summary)
        assertEquals("oldest kept", history[1].summary)
    }

    @Test
    fun `FCH-04 a write prunes stale events for every contact, not just the edited one`() = runTest {
        // Android keeps ONE flat history list for the whole vault (iOS nests
        // it per contact), so the prune is blob-wide by construction. That is
        // the point — the quota is on the blob, not per contact — and FCH-04
        // never displays anything out of window anyway. Pinned so a future
        // "only prune the contact I touched" refactor has to argue with a test.
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val a = vault.addContact("A")
        val b = vault.addContact("B")
        vault.recordAxisEdit(b.id, axis = "etat", summary = "B's ancient edit", at = 0L)
        // Intermediate edit keeps the clock corroborated, so the write below
        // is an ordinary prune rather than the ambiguous dormancy case.
        vault.recordAxisEdit(a.id, axis = "etat", summary = "A's mid edit", at = Vault.HISTORY_RETENTION_MILLIS / 2)

        vault.recordAxisEdit(a.id, axis = "etat", summary = "A's fresh edit", at = Vault.HISTORY_RETENTION_MILLIS + 1_000L)

        assertTrue("B's out-of-window event must go too", vault.getHistory(b.id).isEmpty())
        assertEquals(2, vault.getHistory(a.id).size)
    }

    @Test
    fun `FCH-04 a write under a fast device clock does not delete real history`() = runTest {
        // Regression: the cutoff used to come straight off the caller's `at`.
        // A device clock running years fast made one chip tap compute a cutoff
        // in the future, so EVERY stored event fell outside it and was deleted
        // — persisted immediately, then pushed to the server by VaultSync,
        // which sends the whole blob and re-sends it unmerged on 409. The read
        // filter cannot bring deleted rows back. Hiding history on a bad clock
        // is survivable; destroying it is not.
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val a = vault.addContact("A")
        val b = vault.addContact("B")
        val realNow = 10L * 365 * 24 * 60 * 60 * 1000
        vault.recordAxisEdit(a.id, axis = "etat", summary = "A real", at = realNow)
        vault.recordAxisEdit(b.id, axis = "etat", summary = "B real", at = realNow)

        // Clock jumps four years forward, then one chip tap.
        val skewed = realNow + 4L * 365 * 24 * 60 * 60 * 1000
        vault.recordAxisEdit(a.id, axis = "ressenti", summary = "under a wrong clock", at = skewed)

        assertEquals("A's real event must survive a skewed write", 2, vault.getHistory(a.id).size)
        assertEquals("an untouched contact must not lose history either", 1, vault.getHistory(b.id).size)
    }

    @Test
    fun `FCH-04 a stored future-dated event does not poison later pruning`() = runTest {
        // The mirror: once a skewed event IS stored, the anchor must fall back
        // to the caller's clock, or the bogus timestamp becomes the new cutoff
        // basis and wipes everything on the next ordinary edit.
        val vault = newVault()
        val contact = vault.addContact("Nadia")
        val realNow = 10L * 365 * 24 * 60 * 60 * 1000
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "real", at = realNow)
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "bogus future", at = realNow + 4L * 365 * 24 * 60 * 60 * 1000)

        vault.recordAxisEdit(contact.id, axis = "etat", summary = "ordinary", at = realNow + 1_000L)

        val summaries = vault.getHistory(contact.id).map { it.summary }
        assertTrue("the real event must survive: got $summaries", summaries.contains("real"))
        assertEquals(3, summaries.size)
    }

    @Test
    fun `FCH-04 blob size stays bounded under repeated edits`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Yara")
        // The 50 back-dated events are what give the `== 100` assertion its
        // teeth: without pruning the feed holds 150. A bare 100-edit loop
        // would only assert that the loop ran, and passes with pruning off.
        repeat(50) { i ->
            vault.recordAxisEdit(contact.id, axis = "etat", summary = "ancient $i", at = i.toLong())
        }
        assertEquals("all 50 seeds land in the same epoch window", 50, vault.getHistory(contact.id).size)

        val freshBase = Vault.HISTORY_RETENTION_MILLIS + 1_000L
        repeat(100) { i ->
            vault.recordAxisEdit(contact.id, axis = "etat", summary = "recent $i", at = freshBase + i)
        }

        val history = vault.getHistory(contact.id)
        assertEquals("the 50 stale events are pruned; only the 100 in-window ones remain", 100, history.size)
        assertTrue("nothing older than the window survives", history.all { it.at >= freshBase + 99 - Vault.HISTORY_RETENTION_MILLIS })
    }

    @Test
    fun `FCH-05 confirmStillAccurate resets the timer and clears the snooze`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Sami")
        vault.recordAxisEdit(contact.id, axis = "etat", summary = "x", at = 1L)
        vault.snoozeStaleness(contact.id, at = 2L)

        vault.confirmStillAccurate(contact.id, at = 3L)

        val updated = vault.getContacts().first()
        assertEquals(3L, updated.lastAxisChangeAt)
        assertNull(updated.staleSnoozedUntil)
    }

    @Test
    fun `FCH-05 snoozeStaleness pushes staleSnoozedUntil 30 days out from the given instant`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Sami")
        vault.snoozeStaleness(contact.id, at = 10_000L)
        assertEquals(10_000L + Vault.SNOOZE_MILLIS, vault.getContacts().first().staleSnoozedUntil)
    }

    @Test
    fun `FCH-08 a newly added contact has no targetId - hasn't joined swab yet`() = runTest {
        val vault = newVault()
        val contact = vault.addContact("Pending Person")
        assertNull(vault.getContacts().first().targetId)
        assertEquals(contact.id, vault.getContacts().first().id) // sanity
    }

    // ------------------------------------------------------------ VLT-04
    // The write-notification seam SUG-AND-001 added: the vault tells whoever
    // is listening that something changed, and knows nothing about them (no
    // network or scheduler import in this package — SyncTriggerWiringStructuralTest).

    @Test
    fun test_VLT04_everyPersistedWriteInvokesTheOnPersistCallback() = runTest {
        var notifications = 0
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore(), onPersist = { notifications++ })

        val contact = vault.addContact("Nadia")
        assertEquals(1, notifications)

        vault.setRing(contact.id, 2)
        vault.setEtat(contact.id, Etat.BUSY)
        vault.setRoles(contact.id, listOf(RoleContexte.COLLEAGUE))
        vault.recordAxisEdit(contact.id, axis = "intimite", summary = "x", at = 1L)
        vault.snoozeStaleness(contact.id, at = 2L)

        assertEquals("one notification per persisted write", 6, notifications)
    }

    @Test
    fun test_VLT04_readsDoNotInvokeTheOnPersistCallback() = runTest {
        var notifications = 0
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore(), onPersist = { notifications++ })
        vault.addContact("Nadia")
        notifications = 0

        vault.getContacts()
        vault.getHistory("nobody")
        vault.loadState()
        vault.setVaultVersion(7)

        // setVaultVersion is sync bookkeeping written BY the sync itself —
        // notifying on it would make every successful push schedule another.
        assertEquals(0, notifications)
    }

    @Test
    fun test_VLT10_getEncryptedVault_materialisingTheFirstBlob_doesNotReArmTheScheduler() = runTest {
        // getEncryptedVault() is what a SYNC calls. On a vault that has never
        // been written it has to materialise a blob, and that write used to
        // fire onPersist — so a read-only sync scheduled another sync, which
        // materialised nothing and scheduled another. The notification is for
        // user intent, not for the sync's own bookkeeping.
        var notifications = 0
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore(), onPersist = { notifications++ })

        vault.getEncryptedVault()

        assertEquals(0, notifications)
    }

    @Test
    fun test_VLT04_anUnreadableVaultNeverNotifies_soNothingPushesOverGoodServerData() = runTest {
        val kv = InMemoryKeyValueStore()
        kv.set("vault.blob.v1", "AAAA") // truncated — Unreadable (SUG-AND-004)
        var notifications = 0
        val vault = Vault(kv, InMemoryVaultKeyStore(), onPersist = { notifications++ })

        vault.addContact("Nadia")

        assertEquals(VaultLoadState.Unreadable, vault.loadState())
        assertEquals(0, notifications)
    }
}
