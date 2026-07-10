package com.swab.android.vault

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
        vault.setEtat(contact.id, "disponible")
        vault.setRessenti(contact.id, "douceur")
        var loaded = vault.getContacts().first()
        assertEquals("disponible", loaded.etat)
        assertEquals("douceur", loaded.ressenti)

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
}
