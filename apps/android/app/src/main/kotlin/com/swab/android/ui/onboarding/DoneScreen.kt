package com.swab.android.ui.onboarding

import androidx.compose.runtime.Composable
import com.swab.android.l10n.Fr

/**
 * ONB-07: completion. Vault sync is attempted best-effort by the caller
 * (offline completion is first-class, FS-01 acceptance 1); this composable
 * only renders the promise and the CTA.
 */
@Composable
fun DoneScreen(onFinish: () -> Unit) {
    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.DONE_TITLE)
        BodyText(Fr.DONE_SUBTITLE)
        BodyText(Fr.DONE_PROMISE)
        PrimaryButton(Fr.DONE_CTA, onClick = onFinish)
    }
}
