package com.swab.android.ui.onboarding

import androidx.compose.runtime.Composable
import com.swab.android.l10n.Fr

/** ONB-01: brand, tagline, privacy promise, single CTA. */
@Composable
fun WelcomeScreen(onStart: () -> Unit) {
    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.WELCOME_TAGLINE)
        BodyText(Fr.WELCOME_PROMISE)
        PrimaryButton(Fr.WELCOME_CTA, onClick = onStart)
    }
}
