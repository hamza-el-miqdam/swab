package com.swab.android.ui.onboarding

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.swab.android.l10n.Fr
import com.swab.android.onboarding.SignupViewModel

/**
 * ONB-02 (second half): OTP verification. Restart between phone and OTP
 * loses the memory-only pending hash — resumes at the "missing phone" seam,
 * matching apps/mobile/app/onboarding/otp.tsx.
 */
@Composable
fun OtpScreen(viewModel: SignupViewModel, onBackToPhone: () -> Unit, onVerified: () -> Unit) {
    val uiState by viewModel.uiState.collectAsState()

    if (viewModel.pendingPhoneHash == null) {
        OnboardingScreen {
            Brand()
            BodyText(Fr.OTP_MISSING_PHONE)
            PrimaryButton(Fr.OTP_BACK_TO_PHONE, onClick = onBackToPhone)
        }
        return
    }

    var code by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }

    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.OTP_TITLE)
        uiState.devCode?.let { BodyText("Code (dev) : $it") }
        InputField(value = code, placeholder = Fr.OTP_PLACEHOLDER, onValueChange = { code = it.take(6) })
        if (uiState.needsName) {
            InputField(value = displayName, placeholder = Fr.OTP_NAME_PROMPT, onValueChange = { displayName = it })
        }
        if (uiState.otpError) {
            BodyText(Fr.OTP_ERROR)
        }
        PrimaryButton(
            Fr.OTP_CTA,
            enabled = !uiState.busy && code.length == 6 &&
                (!uiState.needsName || displayName.trim().isNotEmpty()),
            onClick = { viewModel.verifyOtp(code, displayName, onVerified) },
        )
    }
}
