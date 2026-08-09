package com.swab.android.e2e

import androidx.compose.ui.test.assertTouchHeightIsEqualTo
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.swab.android.MainActivity
import com.swab.android.l10n.Fr
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * SUG-DES-011 — interactive chip/switch controls must accept touches in a
 * >=48dp region even though their charter-defined VISUAL geometry stays
 * smaller (tag ~34dp, segmented/intimacy cell ~36dp, switch track 21dp).
 * `Modifier.minimumInteractiveComponentSize()` was added to the Fiche axis
 * FilterChips (FicheScreen.kt) and the Carte list-mode Switch
 * (CarteScreen.kt) to close this gap; these assertions lock the tappable
 * bounds without asserting anything about drawn pixel size (a separate,
 * untouched concern per the suggestion's "do not enlarge visuals" rule).
 *
 * FLAGGED (do not silently paper over): the suggestion's acceptance
 * criteria name `assertTouchHeightIsAtLeast(48.dp)`. That function does NOT
 * exist in this project's pinned Compose Test version (compose-bom
 * 2024.09.00 -> androidx.compose.ui:ui-test 1.7.0 — confirmed by
 * decompiling BoundsAssertionsKt, which ships only
 * `assertTouchHeightIsEqualTo`/`assertTouchWidthIsEqualTo` plus
 * `assertHeightIsAtLeast`/`assertWidthIsAtLeast` on VISUAL, not touch,
 * bounds). Bumping the whole compose-bom to chase one assertion helper is a
 * wide-blast-radius change this environment has no emulator to verify
 * end-to-end, so it was not done unilaterally. `assertTouchHeightIsEqualTo`
 * is used instead: `minimumInteractiveComponentSize()` pads the touch
 * target to EXACTLY 48dp whenever the underlying visual size is smaller (as
 * it is for all three controls here), so equality and "at least" coincide
 * in practice for this specific regression check.
 */
@RunWith(AndroidJUnit4::class)
class FicheTouchTargetsTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun test_SUGDES011_etatTagRow_touchBoundsAtLeast48dp() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))
        composeTestRule.onNodeWithContentDescription("Sam — ${Fr.RING_1}").performClick()
        composeTestRule.waitUntilContentDescriptionExists(Fr.CARTE_OPEN_FICHE)
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).performClick()
        composeTestRule.waitUntilTextExists(Fr.FICHE_AXIS_ETAT)

        // The État axis is a row of "tag"-equivalent FilterChips (visual
        // height ~34dp per SUG-DES-011). Their tappable region must be
        // >=48dp regardless of the smaller drawn size.
        composeTestRule.onNodeWithText(Fr.ETAT_AVAILABLE).assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun test_SUGDES011_intimiteSegmentedCell_touchBoundsAtLeast48dp() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))
        composeTestRule.onNodeWithContentDescription("Sam — ${Fr.RING_1}").performClick()
        composeTestRule.waitUntilContentDescriptionExists(Fr.CARTE_OPEN_FICHE)
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).performClick()
        composeTestRule.waitUntilTextExists(Fr.FICHE_AXIS_INTIMITE)

        // Intimité is the segmented/intimacy-cell equivalent (visual height
        // ~36dp per SUG-DES-011).
        composeTestRule.onNodeWithText(Fr.RING_1).assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun test_SUGDES011_listModeSwitch_touchBoundsAtLeast48dp() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))
        composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)

        // The Carte list-mode Switch: charter track is 38x21dp visually.
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_LIST_MODE).assertTouchHeightIsEqualTo(48.dp)
    }
}
