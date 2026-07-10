package com.swab.android.ui.onboarding

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.swab.android.l10n.Fr
import com.swab.android.onboarding.SignupViewModel

/** ONB-02 (first half): phone entry, hashed on-device before any network call. */
@Composable
fun PhoneScreen(viewModel: SignupViewModel, onOtpRequested: () -> Unit) {
    val uiState by viewModel.uiState.collectAsState()
    var raw by remember { mutableStateOf("") }

    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.PHONE_TITLE)
        BodyText(Fr.PHONE_HINT)
        InputField(value = raw, placeholder = Fr.PHONE_PLACEHOLDER, onValueChange = { raw = it })
        if (uiState.phoneError) {
            BodyText(Fr.PHONE_ERROR)
        }
        PrimaryButton(
            Fr.PHONE_CTA,
            enabled = !uiState.busy && raw.trim().length >= 6,
            onClick = { viewModel.submitPhone(raw, onOtpRequested) },
        )
    }
}
