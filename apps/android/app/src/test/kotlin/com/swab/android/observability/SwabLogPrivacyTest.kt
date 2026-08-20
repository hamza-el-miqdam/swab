package com.swab.android.observability

import com.swab.android.MainDispatcherRule
import com.swab.android.identity.InMemorySecureTokenStore
import com.swab.android.identity.PhoneHash
import com.swab.android.network.ApiClient
import com.swab.android.network.HttpResponse
import com.swab.android.network.HttpTransport
import com.swab.android.onboarding.OnboardingStateStore
import com.swab.android.onboarding.SignupViewModel
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
import java.io.IOException

/**
 * SUG-AND-012 / G3: the logger seam must never carry the raw phone number,
 * its hash, session token material, or the vault blob — only event names
 * and whitelisted scalar fields (types, counts, versions).
 */
class SwabLogPrivacyTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    /** First call succeeds (OTP request); every call after that throws — simulates a DNS/TLS/parse failure, not an ApiError status. */
    private class SucceedOnceThenThrowTransport : HttpTransport {
        private var calls = 0

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            calls++
            if (calls == 1) return HttpResponse(200, """{"devCode":"111111"}""")
            throw IOException("network unreachable")
        }
    }

    private class AlwaysThrowingTransport : HttpTransport {
        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            throw IOException("network unreachable")
        }
    }

    /** push -> 409, pull -> a server blob, retry-push -> 409 again: a genuine persisted conflict (mirrors VaultSyncTest). */
    private class PersistentConflictTransport : HttpTransport {
        private val responses = mutableListOf(
            "POST" to HttpResponse(409, ""),
            "GET" to HttpResponse(200, """{"blob":"server-blob","version":5}"""),
            "POST" to HttpResponse(409, ""),
        )

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse =
            if (responses.isNotEmpty()) responses.removeAt(0).second else HttpResponse(500, "")
    }

    @Test
    fun `submitPhone failure never logs the raw phone number or its hash`() = runTest {
        val logger = RecordingLogger()
        val rawPhone = "+33612345678"
        val phoneHash = PhoneHash.hashPhoneNumber(rawPhone)
        val vm = SignupViewModel(
            apiClient = ApiClient(AlwaysThrowingTransport(), baseUrl = "http://x"),
            tokenStore = InMemorySecureTokenStore(),
            vaultKeyStore = InMemoryVaultKeyStore(),
            onboardingStateStore = OnboardingStateStore(InMemoryKeyValueStore()),
            logger = logger,
        )

        vm.submitPhone(rawPhone) { }
        advanceUntilIdle()

        assertTrue("expected a failure event to be logged", logger.events.isNotEmpty())
        val logged = logger.loggedStrings()
        assertFalse(logged.any { it.contains(rawPhone) })
        assertFalse(logged.any { it.contains(phoneHash) })
    }

    @Test
    fun `verifyOtp failure never logs session token material`() = runTest {
        val logger = RecordingLogger()
        val vm = SignupViewModel(
            apiClient = ApiClient(SucceedOnceThenThrowTransport(), baseUrl = "http://x"),
            tokenStore = InMemorySecureTokenStore(),
            vaultKeyStore = InMemoryVaultKeyStore(),
            onboardingStateStore = OnboardingStateStore(InMemoryKeyValueStore()),
            logger = logger,
        )
        vm.submitPhone("+33612345678") { }
        advanceUntilIdle()

        vm.verifyOtp("111111", null) { }
        advanceUntilIdle()

        assertTrue("expected a failure event to be logged", logger.events.isNotEmpty())
        val logged = logger.loggedStrings()
        assertFalse(logged.any { it.contains("accessToken") || it.contains("refreshToken") })
    }

    @Test
    fun `VaultSync conflict-persisted failure never logs the blob`() = runTest {
        val logger = RecordingLogger()
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        vault.addContact("Should Never Leak")
        val blob = vault.getEncryptedVault().blob
        val sync = VaultSync(vault, ApiClient(PersistentConflictTransport(), baseUrl = "http://x"), logger)

        try {
            sync.syncVault()
        } catch (_: VaultSync.ConflictPersistedException) {
            // expected — the assertion is on what got logged along the way.
        }

        assertTrue("expected conflict events to be logged", logger.events.isNotEmpty())
        val logged = logger.loggedStrings()
        assertFalse(logged.any { it.contains(blob) })
    }
}
