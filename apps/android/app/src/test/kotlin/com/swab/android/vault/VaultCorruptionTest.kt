package com.swab.android.vault

import com.swab.android.storage.InMemoryKeyValueStore
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * SUG-AND-004 / VLT-05 — a corrupt blob or lost Keystore key must surface as
 * an honest [VaultLoadState.Unreadable], never crash the app or silently
 * clobber the on-disk blob. Mirrors VaultTest's InMemory* fakes.
 */
class VaultCorruptionTest {

    private val blobKey = "vault.blob.v1"

    @Test
    fun `VLT-05 truncated blob yields Unreadable state, not a crash`() = runTest {
        val kv = InMemoryKeyValueStore()
        kv.set(blobKey, "AAAA") // 3 raw bytes — far short of IV(12)+TAG(16)
        val vault = Vault(kv, InMemoryVaultKeyStore())

        assertEquals(VaultLoadState.Unreadable, vault.loadState())
        assertTrue(vault.getContacts().isEmpty())
    }

    @Test
    fun `VLT-05 wrong key on a well-formed blob yields Unreadable`() = runTest {
        val kv = InMemoryKeyValueStore()
        val writer = Vault(kv, InMemoryVaultKeyStore(), idGenerator = { "fixed-id" })
        writer.addContact("Secret Name")

        // A fresh InMemoryVaultKeyStore generates its own random key — it
        // never had the key that encrypted this blob (simulates a lost/
        // invalidated Android Keystore key).
        val reader = Vault(kv, InMemoryVaultKeyStore())

        assertEquals(VaultLoadState.Unreadable, reader.loadState())
        assertTrue(reader.getContacts().isEmpty())
    }

    @Test
    fun `VLT-05 an unreadable vault never overwrites the blob on disk`() = runTest {
        val kv = InMemoryKeyValueStore()
        kv.set(blobKey, "AAAA")
        val vault = Vault(kv, InMemoryVaultKeyStore())
        assertEquals(VaultLoadState.Unreadable, vault.loadState())

        val before = kv.get(blobKey)

        // Writes must be silently rejected while Unreadable — never clobber
        // a possibly-recoverable blob with a fresh empty one.
        vault.addContact("Should not persist")
        assertEquals(before, kv.get(blobKey))

        vault.getEncryptedVault()
        assertEquals("getEncryptedVault must not push a fresh blob either", before, kv.get(blobKey))
    }

    @Test
    fun `VLT-01 a healthy blob still hydrates Ok and round-trips unchanged`() = runTest {
        val kv = InMemoryKeyValueStore()
        val keyStore = InMemoryVaultKeyStore()
        val original = Vault(kv, keyStore, idGenerator = { "fixed-id" })
        original.addContact("Amine")

        val resumed = Vault(kv, keyStore, idGenerator = { "fixed-id" })
        assertEquals(VaultLoadState.Ok, resumed.loadState())
        assertEquals(1, resumed.getContacts().size)
        assertEquals("Amine", resumed.getContacts().first().displayName)
    }
}
