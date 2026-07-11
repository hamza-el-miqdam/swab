package com.swab.android.e2e

import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.swab.android.MainActivity
import com.swab.android.carte.MapGeometry
import com.swab.android.l10n.Fr
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * FS-02 relationship map, end to end: MAP-01..09. Each test completes a
 * fresh onboarding first so the map has real
 * vault-backed contacts to render, then drives the actual radial
 * canvas/list/peek-sheet UI.
 */
@RunWith(AndroidJUnit4::class)
class RelationshipMapE2ETest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    private val samLabel = "Sam — ${Fr.RING_1}"
    private val linaLabel = "Lina — ${Fr.RING_2}"

    @Test
    fun test_MAP01_09_mapRendersMoiAndPlacedContactNodes() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1, "Lina" to 2))

        composeTestRule.onNodeWithContentDescription(Fr.CARTE_ME).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(samLabel).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(linaLabel).assertIsDisplayed()
    }

    @Test
    fun test_MAP04_peekSheetShowsCorrectRowsAndOpenFicheIsEnabled() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1, "Lina" to 2))

        composeTestRule.onNodeWithContentDescription(samLabel).performClick()
        composeTestRule.waitUntilTextExists(Fr.CARTE_SHEET_INTIMITE)

        composeTestRule.onNodeWithText("Sam").assertIsDisplayed()
        composeTestRule.onNodeWithText(Fr.RING_1).assertIsDisplayed() // Intimité row value
        // Wave 3 wired this seam live — previously rendered visibly disabled
        // (FS-02 Wave 2 changelog entry). Confirm it's genuinely enabled now.
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).assertIsEnabled()

        // Selecting the other node updates the sheet in place (MAP-04).
        // Material3 ModalBottomSheet handles the system back gesture as a
        // dismiss — more reliable in a test than guessing a scrim tap target.
        composeTestRule.waitForIdle()
        Espresso.pressBack()
        composeTestRule.waitUntilTextGone(Fr.CARTE_SHEET_INTIMITE)

        composeTestRule.onNodeWithContentDescription(linaLabel).performClick()
        composeTestRule.waitUntilTextExists(Fr.CARTE_SHEET_INTIMITE)
        composeTestRule.onNodeWithText("Lina").assertIsDisplayed()
        composeTestRule.onNodeWithText(Fr.RING_2).assertIsDisplayed()
    }

    @Test
    fun test_MAP08_listModeGroupsContactsByIntimacyLevel() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1, "Lina" to 2))

        composeTestRule.onNodeWithContentDescription(Fr.CARTE_LIST_MODE).performClick()

        composeTestRule.waitUntilTextExists(Fr.RING_1)
        composeTestRule.onNodeWithText(Fr.RING_1).assertIsDisplayed() // section header
        composeTestRule.onNodeWithText(Fr.RING_2).assertIsDisplayed() // section header
        composeTestRule.onNodeWithContentDescription(samLabel).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(linaLabel).assertIsDisplayed()

        // Toggle back — map re-appears without data loss.
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_LIST_MODE).performClick()
        composeTestRule.waitUntilContentDescriptionExists(samLabel)
        composeTestRule.onNodeWithContentDescription(samLabel).assertIsDisplayed()
    }

    /**
     * MAP-02 — the persistent bottom nav exposes EXACTLY three destinations
     * (Carte / Envie / Sous-groupes), each one actually navigates, and no
     * badge/unread counter exists anywhere on screen (asserted as "no
     * standalone digits-only text node", the shape any numeric badge must
     * take — see [assertNoNumericBadgeText]).
     */
    @Test
    fun test_MAP02_bottomNavExactlyThreeDestinations_noBadges() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))

        // Exactly three Tab-role items — not "at least the three we know".
        val tabs = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Tab)
        composeTestRule.onAllNodes(tabs).assertCountEquals(3)
        composeTestRule.onNodeWithContentDescription(Fr.NAV_CARTE).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(Fr.NAV_ENVIE).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(Fr.NAV_SOUS_GROUPES).assertIsDisplayed()
        composeTestRule.assertNoNumericBadgeText()

        // Each destination is really reachable and the nav persists there.
        composeTestRule.onNodeWithContentDescription(Fr.NAV_ENVIE).performClick()
        composeTestRule.waitUntilTextExists(Fr.ENVIE_PLACEHOLDER)
        composeTestRule.onAllNodes(tabs).assertCountEquals(3)
        composeTestRule.assertNoNumericBadgeText()

        composeTestRule.onNodeWithContentDescription(Fr.NAV_SOUS_GROUPES).performClick()
        composeTestRule.waitUntilTextExists(Fr.SOUSGROUPES_PLACEHOLDER)
        composeTestRule.onAllNodes(tabs).assertCountEquals(3)
        composeTestRule.assertNoNumericBadgeText()

        composeTestRule.onNodeWithContentDescription(Fr.NAV_CARTE).performClick()
        composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)
    }

    /**
     * MAP-06 — a user who skips contact import entirely (« Passer », ONB-03's
     * no-penalty path) lands on a CALM empty map: the invite copy
     * ([Fr.CARTE_EMPTY]) renders, and nothing on the empty Calibrate or Carte
     * screens carries progress framing (percent/counter scan, same scanner as
     * ONB-09) or a badge-shaped numeric node.
     */
    @Test
    fun test_MAP06_skipContactsOnboarding_emptyMapIsCalm() {
        composeTestRule.signUpThroughOtp("Nadia")

        composeTestRule.waitUntilTextExists(Fr.CONTACTS_TITLE)
        composeTestRule.onNodeWithText(Fr.CONTACTS_SKIP).performClick()

        // Empty calibrate: the "place people later" copy, no alarm framing.
        composeTestRule.waitUntilTextExists(Fr.CALIBRATE_TITLE)
        composeTestRule.onNodeWithText(Fr.CALIBRATE_EMPTY).assertIsDisplayed()
        composeTestRule.assertNoGamificationCopy("calibrate-empty")
        composeTestRule.onNodeWithText(Fr.CALIBRATE_CONTINUE).performClick()

        composeTestRule.waitUntilTextExists(Fr.DONE_TITLE)
        composeTestRule.onNodeWithText(Fr.DONE_CTA).performClick()

        // Empty Carte: calm invite copy, « moi » still centered, no numbers.
        composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)
        composeTestRule.onNodeWithText(Fr.CARTE_EMPTY).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_ME).assertIsDisplayed()
        composeTestRule.assertNoGamificationCopy("carte-empty")
        composeTestRule.assertNoNumericBadgeText()
    }

    /**
     * Regression test for the Wave-2 density-scaling bug (documented in
     * apps/android/CHANGELOG.md, 2026-07-10): `MapGeometry`'s dp-equivalent
     * units were run through `Float.toDp()` a second time, which treats the
     * numbers as raw device pixels and divides by density — on a
     * high-density emulator (this device: 560dpi, ~3.5x, confirmed via
     * `adb shell wm density` at authoring time) the map collapsed to
     * roughly 1/3.5 size. `moi`'s hardcoded 44.dp did NOT collapse (it never
     * went through MapGeometry), which is exactly why placed nodes appeared
     * to overlap it. This test asserts a PLACED contact node's rendered
     * pixel size is close to `MapGeometry.nodeSize(ring).dp * density` —
     * if the collapse bug reappears, the measured size comes back roughly
     * `1/density` of that, which the tolerance below catches.
     */
    @Test
    fun test_densityRegression_placedNodeSizeIsNotCollapsed() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))

        val node = composeTestRule.onNodeWithContentDescription(samLabel).fetchSemanticsNode()
        val density = InstrumentationRegistry.getInstrumentation().targetContext.resources.displayMetrics.density
        val expectedPx = MapGeometry.nodeSize(1) * density
        val actualPx = node.size.width.toFloat()

        assertTrue(
            "expected placed-node width near ${expectedPx}px (density=$density) but measured ${actualPx}px " +
                "— looks collapsed, possible regression of the Wave-2 Float.toDp() density bug",
            actualPx >= expectedPx * 0.6f,
        )
        assertTrue(
            "expected placed-node width near ${expectedPx}px (density=$density) but measured ${actualPx}px " +
                "— unexpectedly large",
            actualPx <= expectedPx * 1.6f,
        )
    }
}
