package com.swab.android.vault

import com.swab.android.network.ApiClient
import com.swab.android.network.EncryptedVaultBlobDto
import com.swab.android.network.HttpResponse
import com.swab.android.network.HttpTransport
import com.swab.android.storage.InMemoryKeyValueStore
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** VLT-02/VLT-04: push, 409 -> re-pull server version, retry once. */
class VaultSyncTest {

    /** Returns the next scripted response in order, regardless of method/url — tests script the exact call sequence. */
    private class ScriptedTransport(private val responses: MutableList<Pair<String, HttpResponse>>) : HttpTransport {
        val requests = mutableListOf<Triple<String, String, String?>>()

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            requests += Triple(method, url, body)
            return if (responses.isNotEmpty()) responses.removeAt(0).second else HttpResponse(500, "")
        }
    }

    @Test
    fun `VLT-02 successful push updates the local version from the server response`() = runTest {
        val kv = InMemoryKeyValueStore()
        val keyStore = InMemoryVaultKeyStore()
        val vault = Vault(kv, keyStore)
        vault.addContact("Test")

        val transport = ScriptedTransport(mutableListOf("POST" to HttpResponse(200, """{"blob":"x","version":7}""")))
        val apiClient = ApiClient(transport)
        val sync = VaultSync(vault, apiClient)

        sync.syncVault()
        assertEquals(7, vault.getEncryptedVault().version)
    }

    @Test
    fun `VLT-02 409 conflict re-pulls server version and retries once`() = runTest {
        val kv = InMemoryKeyValueStore()
        val keyStore = InMemoryVaultKeyStore()
        val vault = Vault(kv, keyStore)
        vault.addContact("Test")

        val transport = ScriptedTransport(
            mutableListOf(
                "POST" to HttpResponse(409, ""),
                "GET" to HttpResponse(200, """{"blob":"server-blob","version":5}"""),
                "POST" to HttpResponse(200, """{"blob":"server-blob","version":6}"""),
            ),
        )
        val apiClient = ApiClient(transport)
        val sync = VaultSync(vault, apiClient)

        sync.syncVault()
        assertEquals(6, vault.getEncryptedVault().version)
        assertEquals(3, transport.requests.size)
    }

    @Test(expected = VaultSync.ConflictPersistedException::class)
    fun `VLT-02 persistent conflict after retry fails loudly`() = runTest {
        val kv = InMemoryKeyValueStore()
        val keyStore = InMemoryVaultKeyStore()
        val vault = Vault(kv, keyStore)
        vault.addContact("Test")

        val transport = ScriptedTransport(
            mutableListOf(
                "POST" to HttpResponse(409, ""),
                "GET" to HttpResponse(200, """{"blob":"server-blob","version":5}"""),
                "POST" to HttpResponse(409, ""),
            ),
        )
        val apiClient = ApiClient(transport)
        val sync = VaultSync(vault, apiClient)

        sync.syncVault()
    }

    @Test
    fun `VLT-02 only push and pull requests target vault, never classification fields in the URL or body`() = runTest {
        val kv = InMemoryKeyValueStore()
        val keyStore = InMemoryVaultKeyStore()
        val vault = Vault(kv, keyStore)
        vault.addContact(displayName = "Should Never Leak", phoneHash = "hash")
        vault.setRing(vault.getContacts().first().id, 1)

        val transport = ScriptedTransport(mutableListOf("POST" to HttpResponse(200, """{"blob":"x","version":2}""")))
        val apiClient = ApiClient(transport)
        VaultSync(vault, apiClient).syncVault()

        val (_, _, body) = transport.requests.single()
        assertTrue(body != null)
        assertTrue("body must not leak the plaintext display name", body!!.contains("Should Never Leak").not())
        assertTrue("body must not leak ring/roles/etat/ressenti field names", !body.contains("ring") && !body.contains("etat") && !body.contains("ressenti"))
    }
}
