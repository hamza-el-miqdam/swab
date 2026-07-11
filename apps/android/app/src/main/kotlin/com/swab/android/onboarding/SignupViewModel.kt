package com.swab.android.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.swab.android.identity.PhoneHash
import com.swab.android.identity.SecureTokenStore
import com.swab.android.identity.SessionTokens
import com.swab.android.network.ApiClient
import com.swab.android.network.ApiError
import com.swab.android.network.OtpRequestBody
import com.swab.android.network.OtpVerifyBody
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
) : ViewModel() {

    private val _uiState = MutableStateFlow(SignupUiState())
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    val pendingPhoneHash: String? get() = pendingSignup.pendingPhoneHash

    fun submitPhone(rawPhone: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(busy = true, phoneError = false)
            try {
                val phoneHash = PhoneHash.hashPhoneNumber(rawPhone)
                val response = apiClient.requestOtp(OtpRequestBody(phoneHash))
                pendingSignup.setPendingPhoneHash(phoneHash)
                pendingSignup.setDevCode(response.devCode)
                _uiState.value = _uiState.value.copy(busy = false, devCode = response.devCode)
                onSuccess()
            } catch (_: Exception) {
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
                    _uiState.value = _uiState.value.copy(busy = false, otpError = true)
                }
            } catch (_: Exception) {
                _uiState.value = _uiState.value.copy(busy = false, otpError = true)
            }
        }
    }
}
