package com.swab.android.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.swab.android.MainActivity
import com.swab.android.l10n.Fr
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Offline/no-crash smoke test: simulates the device rotating (full Activity
 * destroy + recreate — there is no `configChanges` override in
 * AndroidManifest.xml, so this is a real recreation, not a no-op) after
 * onboarding has completed and vault data exists. Exercises the same class
 * of "state scoped to the wrong lifetime" bug as the Wave-1
 * per-`composable{}` `remember` scoping fix (apps/android/CHANGELOG.md,
 * 2026-07-10) — here at the Activity/process level instead of the
 * NavBackStackEntry level: does the app come back with real data
 * (vault-backed, DataStore-persisted onboarding step), or does it crash /
 * silently reset to Welcome?
 */
@RunWith(AndroidJUnit4::class)
class ActivityRecreationSmokeTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun test_recreateAtCarte_noCrash_contactsSurvive() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1, "Lina" to 2))
        composeTestRule.assertOnCarte()

        composeTestRule.activityRule.scenario.recreate()
        composeTestRule.waitForIdle()

        // Still on Carte (the persisted OnboardingStep.COMPLETE resumes
        // straight there, ONB-08), not bounced back to Welcome, and the
        // vault-backed contacts survived the recreation.
        composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)
        composeTestRule.assertOnCarte()
        composeTestRule.waitUntilContentDescriptionExists("Sam — ${Fr.RING_1}")
        composeTestRule.onNodeWithContentDescription("Sam — ${Fr.RING_1}").assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription("Lina — ${Fr.RING_2}").assertIsDisplayed()
    }

    /**
     * SUG-AND-003 #2 regression guard: `SignupViewModel` used to be built via
     * plain `remember { }` (not `viewModel()`), so it was never owned by a
     * ViewModelStore and was rebuilt from scratch on every Activity
     * recreation — dropping the memory-only `PendingSignup.pendingPhoneHash`
     * and landing the OTP screen on its "missing phone" dead end
     * (`Fr.OTP_MISSING_PHONE`) even though this is a config change, not
     * process death. Now `signupViewModel` is Activity-ViewModelStore-scoped
     * via `viewModel()`, so it must survive.
     */
    @Test
    fun test_ONB02_recreateAtOtp_pendingPhoneHashSurvives() {
        val phone = uniquePhoneNumber()

        composeTestRule.waitUntilTextExists(Fr.WELCOME_CTA)
        composeTestRule.onNodeWithText(Fr.WELCOME_CTA).performClick()

        composeTestRule.waitUntilContentDescriptionExists(Fr.PHONE_PLACEHOLDER)
        composeTestRule.onNodeWithContentDescription(Fr.PHONE_PLACEHOLDER).performTextInput(phone)
        composeTestRule.onNodeWithText(Fr.PHONE_CTA).performClick()

        composeTestRule.waitUntilTextExists("Code (dev)", substring = true)

        composeTestRule.activityRule.scenario.recreate()
        composeTestRule.waitForIdle()

        // Still on the real OTP screen (dev code + code input survive the
        // recreation) — not bounced to the "missing phone" fallback.
        composeTestRule.waitUntilTextExists("Code (dev)", substring = true)
        composeTestRule.onNodeWithText(Fr.OTP_MISSING_PHONE).assertDoesNotExist()
    }
}
