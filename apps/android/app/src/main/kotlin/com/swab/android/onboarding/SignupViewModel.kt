package com.swab.android.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.swab.android.BuildConfig
import com.swab.android.identity.PhoneHash
import com.swab.android.identity.SecureTokenStore
import com.swab.android.identity.SessionTokens
import com.swab.android.network.ApiClient
import com.swab.android.network.ApiError
import com.swab.android.network.OtpRequestBody
import com.swab.android.network.OtpVerifyBody
import com.swab.android.observability.NoopLogger
import com.swab.android.observability.SwabLogger
import com.swab.android.vault.VaultKeyStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ONB-02: phone + OTP signup. Port of apps/mobile/app/onboarding/{phone,otp}.tsx
 * + src/onboarding/signup.ts. The raw phone number is hashed on-device in
 * [submitPhone] (IDT-01) — only the hash ever reaches [PendingSignup] or the API.
 * On OTP success: session saved, vault key created BEFORE any classification
 * input is possible, then the onboarding step advances to CONTACTS.
 */
data class SignupUiState(
    val busy: Boolean = false,
    val phoneError: Boolean = false,
    val otpError: Boolean = false,
    val needsName: Boolean = false,
    val devCode: String? = null,
    val verified: Boolean = false,
)

class SignupViewModel(
    private val apiClient: ApiClient,
    private val tokenStore: SecureTokenStore,
    private val vaultKeyStore: VaultKeyStore,
    private val onboardingStateStore: OnboardingStateStore,
    private val pendingSignup: PendingSignup = PendingSignup(),
    private val logger: SwabLogger = NoopLogger(),
) : ViewModel() {

    private val _uiState = MutableStateFlow(SignupUiState())
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    val pendingPhoneHash: String? get() = pendingSignup.pendingPhoneHash

    fun submitPhone(rawPhone: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(busy = true, phoneError = false)
            try {
                // SUG-AND-018: deployment-configurable salt (IDT-06) — must
                // stay the same value across iOS/Android/API or contact
                // discovery breaks.
                val phoneHash = PhoneHash.hashPhoneNumber(rawPhone, salt = BuildConfig.PHONE_HASH_SALT)
                val response = apiClient.requestOtp(OtpRequestBody(phoneHash))
                pendingSignup.setPendingPhoneHash(phoneHash)
                pendingSignup.setDevCode(response.devCode)
                _uiState.value = _uiState.value.copy(busy = false, devCode = response.devCode)
                onSuccess()
            } catch (e: Exception) {
                logger.event(SwabLogger.Level.WARN, "otp.request.failed", mapOf("type" to e.javaClass.simpleName))
                _uiState.value = _uiState.value.copy(busy = false, phoneError = true)
            }
        }
    }

    fun verifyOtp(code: String, displayName: String?, onSuccess: () -> Unit) {
        val phoneHash = pendingSignup.pendingPhoneHash ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(busy = true, otpError = false)
            try {
                val body = if (_uiState.value.needsName) {
                    OtpVerifyBody(phoneHash, code, displayName)
                } else {
                    OtpVerifyBody(phoneHash, code)
                }
                val tokens = apiClient.verifyOtp(body)
                tokenStore.saveTokens(SessionTokens(tokens.accessToken, tokens.refreshToken))
                vaultKeyStore.getOrCreateVaultKey() // ONB-02: key exists before any classification
                pendingSignup.clear()
                onboardingStateStore.setStep(OnboardingStep.CONTACTS)
                _uiState.value = _uiState.value.copy(busy = false, verified = true)
                onSuccess()
            } catch (err: ApiError) {
                if (err.status == 422) {
                    _uiState.value = _uiState.value.copy(busy = false, needsName = true)
                } else {
                    // Issue #128: this branch used to be completely silent —
                    // a 429 (IDT-03's per-IP OTP rate limit) landed here
                    // indistinguishable from any other failure, with zero log
                    // output. That silence is what made the E2E flakiness
                    // look like an unexplained Compose timeout instead of a
                    // rate limit: `otpError` is still the right UI state (no
                    // spec copy exists yet for a distinct rate-limited
                    // message — G4, French copy comes from specs verbatim),
                    // but the status code is now observable (G3).
                    //
                    // 401 (invalid/expired code, apps/api/src/routes/auth.ts)
                    // is an ordinary mistyped-code user error, not a degraded
                    // system state — G3 reserves WARN for the latter. Logging
                    // it at WARN would bury the 429s this event exists to
                    // surface under routine typo volume (review finding,
                    // PR #138), so only 401 gets INFO; everything else
                    // (429, and any other unexpected status) stays WARN.
                    val level = if (err.status == 401) SwabLogger.Level.INFO else SwabLogger.Level.WARN
                    logger.event(level, "otp.verify.failed", mapOf("status" to err.status))
                    _uiState.value = _uiState.value.copy(busy = false, otpError = true)
                }
            } catch (e: Exception) {
                logger.event(SwabLogger.Level.WARN, "otp.verify.failed", mapOf("type" to e.javaClass.simpleName))
                _uiState.value = _uiState.value.copy(busy = false, otpError = true)
            }
        }
    }
}
