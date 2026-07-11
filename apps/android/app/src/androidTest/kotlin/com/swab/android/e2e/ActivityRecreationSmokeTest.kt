package com.swab.android.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
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
}
