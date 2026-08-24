package com.swab.android.e2e

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.swab.android.MainActivity
import com.swab.android.SwabApplication
import com.swab.android.l10n.Fr
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * VLT-10 replay triggers must survive an Activity recreation (SUG-AND-001,
 * review finding F3).
 *
 * The bug this pins: `AppContainer` was built in `MainActivity.onCreate`, so
 * a rotation produced a second `Vault` + `SyncScheduler` + scope. But
 * `viewModel { }` initializers do NOT re-run after a recreation — that is
 * exactly what SUG-AND-003 established — so the surviving ViewModels kept
 * writing through the OLD container's vault, notifying the OLD scheduler,
 * while `onStop`/`onStart` addressed the NEW one, whose `hasPendingWork` was
 * false. Backgrounding after a post-rotation edit therefore no-opped and the
 * edit sat on an orphaned `Dispatchers.Default` scope in a cached process —
 * the very defect this work exists to remove, reintroduced behind a rotation.
 *
 * The oracle is deliberately the process-wide scheduler's own queue rather
 * than the network: with issue #127 open every push fails, so "did a POST
 * succeed" cannot distinguish the two wirings, whereas "did the edit reach
 * the scheduler the lifecycle callbacks talk to" is exactly the invariant at
 * stake. Proven red against the pre-fix wiring before the fix landed.
 */
@RunWith(AndroidJUnit4::class)
class SyncAcrossRecreationE2ETest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    private fun processScheduler() =
        SwabApplication.from(InstrumentationRegistry.getInstrumentation().targetContext).syncScheduler

    @Test
    fun test_VLT10_editAfterRecreation_reachesTheSchedulerTheLifecycleTriggersUse() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))
        composeTestRule.assertOnCarte()

        composeTestRule.activityRule.scenario.recreate()
        composeTestRule.waitForIdle()
        composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)

        // Open Sam's fiche and move him a ring — one real vault write, made
        // through a ViewModel that outlived the recreation.
        composeTestRule.onNodeWithContentDescription("Sam — ${Fr.RING_1}").performClick()
        composeTestRule.waitUntilContentDescriptionExists(Fr.CARTE_OPEN_FICHE)
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).performClick()
        composeTestRule.waitUntilTextExists(Fr.FICHE_AXIS_INTIMITE)
        composeTestRule.onNodeWithText(Fr.RING_2).performClick()
        composeTestRule.waitUntilSelected(Fr.RING_2)
        composeTestRule.onNodeWithText(Fr.RING_2).assertIsSelected()

        // The write must be visible to the process-wide scheduler — the one
        // MainActivity.onStop/onStart drive. Pre-fix it landed on the dead
        // container's scheduler and this stayed false.
        composeTestRule.waitUntil(10_000) { processScheduler().hasPendingWork }
        assertTrue(
            "a fiche edit made after an Activity recreation must queue on the scheduler the lifecycle triggers use",
            processScheduler().hasPendingWork,
        )
    }
}
