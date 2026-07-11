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
 * FS-01 onboarding, end to end, driven through the real Compose UI against
 * the real local API stack (`docker compose up`, `10.0.2.2:3001`). Covers
 * ONB-01..08. Each `@Test` gets a clean app and
 * a fresh phone number (see [uniquePhoneNumber]) so tests don't interfere
 * with each other or with the API's per-phoneHash OTP throttle.
 */
@RunWith(AndroidJUnit4::class)
class OnboardingE2ETest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun test_ONB01_08_happyPath_welcomeToCarte() {
        composeTestRule.completeOnboarding(
            displayName = "Nadia",
            contactRings = listOf("Sam" to 1, "Lina" to 2),
        )

        composeTestRule.assertOnCarte()
    }

    /**
     * ONB-09 — no gamification anywhere in onboarding: drives the full real
     * flow and, at every screen landing (welcome/phone/otp/contacts/
     * calibrate/done), scans the ENTIRE rendered semantics tree for percent
     * signs and X/Y counters (see [assertNoGamificationCopy] for exactly what
     * is and isn't flagged — positional step indication stays allowed).
     * Complements the JVM-side NoGamificationCopyTest, which only checks the
     * `Fr` string TABLE — this catches copy composed at runtime (counters
     * built from state would never appear in `Fr.ALL_STRINGS`).
     */
    @Test
    fun test_ONB09_noGamificationCopyOnAnyOnboardingScreen() {
        composeTestRule.completeOnboarding(
            displayName = "Nadia",
            contactRings = listOf("Sam" to 1),
            onScreen = { screen -> composeTestRule.assertNoGamificationCopy(screen) },
        )
        composeTestRule.assertOnCarte()
    }

    /**
     * Regression test for the Wave-1 bug documented in
     * apps/android/CHANGELOG.md (2026-07-10): `SignupViewModel` was
     * originally `remember`ed inside the Phone and OTP `composable {}`
     * blocks individually instead of hoisted above the `NavHost`, so the
     * memory-only `PendingSignup.pendingPhoneHash` set on the Phone screen
     * was torn down and lost the instant Compose Navigation swapped to the
     * OTP `NavBackStackEntry`. `OtpScreen` detects that loss and falls back
     * to rendering [Fr.OTP_MISSING_PHONE] instead of the OTP input — this
     * test drives exactly that Phone->OTP transition and asserts the real
     * OTP screen (dev code + code input) renders instead of the fallback.
     */
    @Test
    fun test_navigationStateLoss_phoneHashSurvivesPhoneToOtpTransition() {
        val phone = uniquePhoneNumber()

        composeTestRule.waitUntilTextExists(Fr.WELCOME_CTA)
        composeTestRule.onNodeWithText(Fr.WELCOME_CTA).performClick()

        composeTestRule.waitUntilContentDescriptionExists(Fr.PHONE_PLACEHOLDER)
        composeTestRule.onNodeWithContentDescription(Fr.PHONE_PLACEHOLDER).performTextInput(phone)
        composeTestRule.onNodeWithText(Fr.PHONE_CTA).performClick()

        // If the state-loss bug ever regresses, this line times out (the
        // fallback screen never shows a dev code) instead of silently
        // passing — a hard failure is the point.
        composeTestRule.waitUntilTextExists("Code (dev)", substring = true)

        composeTestRule.onNodeWithText(Fr.OTP_TITLE).assertIsDisplayed()
        composeTestRule.onNodeWithText(Fr.OTP_MISSING_PHONE).assertDoesNotExist()
    }
}
