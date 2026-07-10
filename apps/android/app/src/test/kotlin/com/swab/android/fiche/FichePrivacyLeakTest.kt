package com.swab.android.fiche

import com.swab.android.MainDispatcherRule
import com.swab.android.network.ApiClient
import com.swab.android.network.HttpResponse
import com.swab.android.network.HttpTransport
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultSync
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * FS-03 acceptance criterion (G1 privacy invariant): "Given any axis edit,
 * when inspecting network traffic, then only POST /vault (opaque blob)
 * occurs — no field-level classification data in any payload."
 *
 * Drives real fiche edits (all four axes, including free-text-ish role
 * names and history summaries built from the chosen values) through
 * [FicheViewModel], then syncs the vault exactly like production code would
 * (VaultSync, VLT-02/04) and inspects the literal request body a
 * [HttpTransport] would have sent over the wire.
 */
class FichePrivacyLeakTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private class RecordingTransport(private val response: HttpResponse) : HttpTransport {
        var lastBody: String? = null
        var lastUrl: String? = null

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            lastBody = body
            lastUrl = url
            return response
        }
    }

    @Test
    fun `FS-03 acceptance - axis edits never leak plaintext classification data over the wire`() = runTest {
        val kv = InMemoryKeyValueStore()
        val vault = Vault(kv, InMemoryVaultKeyStore())
        val lea = vault.addContact("Should Never Leak Either")

        val vm = FicheViewModel(vault, lea.id, nowProvider = { 1_000_000L })
        advanceUntilIdle()

        vm.setIntimite(1)
        advanceUntilIdle()
        vm.setRoles(listOf("Famille", "Travail"))
        advanceUntilIdle()
        vm.setEtat("disponible")
        advanceUntilIdle()
        vm.setRessenti("en pause")
        advanceUntilIdle()

        // Sanity: the edits actually landed (otherwise this test would prove nothing).
        assertTrue(vault.getHistory(lea.id).isNotEmpty())

        val transport = RecordingTransport(HttpResponse(200, """{"blob":"x","version":2}"""))
        val apiClient = ApiClient(transport, baseUrl = "http://x")
        VaultSync(vault, apiClient).syncVault()

        val body = transport.lastBody
        assertTrue("expected a request body", body != null)
        assertTrue("only /vault should be hit", transport.lastUrl!!.endsWith("/vault"))

        val forbidden = listOf(
            "Should Never Leak Either", // display name
            "Famille", "Travail", // role names
            "disponible", // état
            "en pause", // ressenti
            "Intimité", "Rôles", "État", "Ressenti", // axis labels used in history summaries
            "ring", "roles", "etat", "ressenti", "targetId", // field names
        )
        for (needle in forbidden) {
            assertFalse("request body must not contain plaintext \"$needle\"", body!!.contains(needle))
        }
    }
}
