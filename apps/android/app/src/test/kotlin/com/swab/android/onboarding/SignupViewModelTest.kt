package com.swab.android.onboarding

import com.swab.android.MainDispatcherRule
import com.swab.android.identity.InMemorySecureTokenStore
import com.swab.android.network.ApiClient
import com.swab.android.network.HttpResponse
import com.swab.android.network.HttpTransport
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.vault.InMemoryVaultKeyStore
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** ONB-02: phone + OTP signup view model. */
class SignupViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private class ScriptedTransport(private val responses: MutableList<HttpResponse>) : HttpTransport {
        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse =
            if (responses.isNotEmpty()) responses.removeAt(0) else HttpResponse(500, "")
    }

    private fun newViewModel(transport: HttpTransport, kv: InMemoryKeyValueStore = InMemoryKeyValueStore()): SignupViewModel {
        val apiClient = ApiClient(transport, baseUrl = "http://x")
        return SignupViewModel(
            apiClient = apiClient,
            tokenStore = InMemorySecureTokenStore(),
            vaultKeyStore = InMemoryVaultKeyStore(),
            onboardingStateStore = OnboardingStateStore(kv),
        )
    }

    @Test
    fun `ONB-02 submitPhone hashes on-device and stores the pending hash, not the raw number`() = runTest {
        val transport = ScriptedTransport(mutableListOf(HttpResponse(200, """{"devCode":"123456"}""")))
        val vm = newViewModel(transport)
        var succeeded = false

        vm.submitPhone("+33 6 12 34 56 78") { succeeded = true }
        advanceUntilIdle()

        assertTrue(succeeded)
        assertEquals("07aff4a580d883b2c3fa060b36605b01b8a4ef47dd9c472aa7053a3a90a47712", vm.pendingPhoneHash)
        assertEquals("123456", vm.uiState.value.devCode)
    }

    @Test
    fun `phone request failure surfaces phoneError and clears busy`() = runTest {
        val transport = ScriptedTransport(mutableListOf(HttpResponse(500, "")))
        val vm = newViewModel(transport)

        vm.submitPhone("+33612345678") { }
        advanceUntilIdle()

        assertTrue(vm.uiState.value.phoneError)
        assertTrue(!vm.uiState.value.busy)
    }

    @Test
    fun `ONB-02 verifyOtp saves tokens, creates the vault key, advances step to CONTACTS`() = runTest {
        val kv = InMemoryKeyValueStore()
        val transport = ScriptedTransport(
            mutableListOf(
                HttpResponse(200, """{"devCode":"111111"}"""),
                HttpResponse(200, """{"accessToken":"a","refreshToken":"r"}"""),
            ),
        )
        val vm = newViewModel(transport, kv)
        vm.submitPhone("+33612345678") { }
        advanceUntilIdle()

        var verified = false
        vm.verifyOtp("111111", null) { verified = true }
        advanceUntilIdle()

        assertTrue(verified)
        assertTrue(vm.uiState.value.verified)
        assertEquals(OnboardingStep.CONTACTS, OnboardingStateStore(kv).getStep())
        assertEquals(null, vm.pendingPhoneHash) // cleared after verification (memory-only)
    }

    @Test
    fun `422 from verifyOtp reveals the needsName field instead of a generic error`() = runTest {
        val transport = ScriptedTransport(
            mutableListOf(
                HttpResponse(200, """{"devCode":"111111"}"""),
                HttpResponse(422, ""),
            ),
        )
        val vm = newViewModel(transport)
        vm.submitPhone("+33612345678") { }
        advanceUntilIdle()

        vm.verifyOtp("111111", null) { }
        advanceUntilIdle()

        assertTrue(vm.uiState.value.needsName)
        assertTrue(!vm.uiState.value.otpError)
    }
}
