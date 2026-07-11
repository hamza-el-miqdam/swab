package com.swab.android.e2e

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.swab.android.MainActivity
import com.swab.android.l10n.Fr
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * FS-03 « Fiche contact », end to end: FCH-01..08. Wires the FS-02 seam this
 * Wave 3 added — « Ouvrir la fiche » in the peek sheet — through to a real
 * axis edit and its persistence across leaving and re-entering the fiche.
 */
@RunWith(AndroidJUnit4::class)
class FicheE2ETest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    private val samLabelRing1 = "Sam — ${Fr.RING_1}"
    private val samLabelRing2 = "Sam — ${Fr.RING_2}"

    /** Onboards with Sam on ring 1, then opens his fiche via the map's peek
     * sheet (FS-02 -> FS-03 seam) — shared preamble for every test below. */
    private fun onboardAndOpenSamFiche() {
        composeTestRule.completeOnboarding("Nadia", listOf("Sam" to 1))
        composeTestRule.onNodeWithContentDescription(samLabelRing1).performClick()
        composeTestRule.waitUntilContentDescriptionExists(Fr.CARTE_OPEN_FICHE)
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).performClick()
        composeTestRule.waitUntilTextExists(Fr.FICHE_AXIS_INTIMITE)
    }

    @Test
    fun test_FCH01_08_openEditBackReopen_editPersists() {
        onboardAndOpenSamFiche()
        composeTestRule.onNodeWithText("Sam").assertIsDisplayed()
        // Loaded at ring 1 (set during calibration).
        composeTestRule.waitUntilSelected(Fr.RING_1)
        composeTestRule.onNodeWithText(Fr.RING_1).assertIsSelected()

        // Edit the Intimité axis: move Sam from ring 1 to ring 2 (FCH-01,
        // optimistic + offline-capable — no network round trip for this write).
        composeTestRule.onNodeWithText(Fr.RING_2).performClick()
        composeTestRule.waitUntilSelected(Fr.RING_2) // vault write + recomposition can lag the tap by a beat
        composeTestRule.onNodeWithText(Fr.RING_2).assertIsSelected()

        // Back out (FCH-07: Carte's map position is untouched underneath —
        // covered structurally by the existing composition, not re-asserted
        // pixel-for-pixel here).
        composeTestRule.onNodeWithContentDescription(Fr.FICHE_BACK).performClick()
        composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)

        // Re-open the fiche via the SAME contact id. Correction (found while
        // getting this suite green on a real emulator, 2026-07-10): an
        // earlier draft of this test assumed CarteViewModel's `contacts`
        // list stayed stale on return from Fiche. That assumption was wrong
        // — CarteScreen's `LaunchedEffect(Unit) { viewModel.refresh() }`
        // (ui/carte/CarteScreen.kt) re-fires every time the Carte
        // `composable {}` re-enters composition, which includes navigating
        // back from Fiche, so the map's node label already reflects the
        // ring-2 edit by the time we're back here. Re-navigating to
        // fiche/{contactId} also constructs a brand-new FicheViewModel that
        // reloads straight from the vault by id — that's the actual
        // persistence check below.
        composeTestRule.waitUntilContentDescriptionExists(samLabelRing2)
        composeTestRule.onNodeWithContentDescription(samLabelRing2).performClick()
        composeTestRule.waitUntilContentDescriptionExists(Fr.CARTE_OPEN_FICHE)
        composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).performClick()

        composeTestRule.waitUntilTextExists(Fr.FICHE_AXIS_INTIMITE)
        composeTestRule.waitUntilSelected(Fr.RING_2)
        composeTestRule.onNodeWithText(Fr.RING_2).assertIsSelected() // the edit persisted
    }

    /**
     * FCH-04 — each axis edit appends a VISIBLE history event, newest first.
     * Fresh onboarding leaves history empty (calibration writes rings via
     * `Vault.setRing` directly, without `recordAxisEdit` — only fiche edits
     * feed the feed), so the sequence asserted is:
     * empty -> « État → occupé » -> « Ressenti → léger » above it.
     */
    @Test
    fun test_FCH04_axisEditAppendsVisibleHistory_newestFirst() {
        onboardAndOpenSamFiche()

        // Starts empty: calibration is not a fiche edit.
        composeTestRule.onNodeWithText(Fr.FICHE_HISTORY_TITLE).performScrollTo()
        composeTestRule.onNodeWithText(Fr.FICHE_HISTORY_EMPTY).assertIsDisplayed()

        // First edit: état -> occupé.
        composeTestRule.onNodeWithText(Fr.ETAT_BUSY).performClick()
        val etatSummary = "${Fr.FICHE_AXIS_ETAT} → ${Fr.ETAT_BUSY}"
        composeTestRule.waitUntilTextExists(etatSummary)
        composeTestRule.waitUntilTextGone(Fr.FICHE_HISTORY_EMPTY)

        // Second edit: ressenti -> léger.
        composeTestRule.onNodeWithText(Fr.RESSENTI_LIGHT).performClick()
        val ressentiSummary = "${Fr.FICHE_AXIS_RESSENTI} → ${Fr.RESSENTI_LIGHT}"
        composeTestRule.waitUntilTextExists(ressentiSummary)

        // Both visible...
        composeTestRule.onNodeWithText(etatSummary).performScrollTo().assertIsDisplayed()
        composeTestRule.onNodeWithText(ressentiSummary).performScrollTo().assertIsDisplayed()

        // ...and newest FIRST: the later ressenti edit renders ABOVE the
        // earlier état edit (smaller y in root coordinates).
        val ressentiY = composeTestRule.onNodeWithText(ressentiSummary).fetchSemanticsNode().positionInRoot.y
        val etatY = composeTestRule.onNodeWithText(etatSummary).fetchSemanticsNode().positionInRoot.y
        assertTrue(
            "FCH-04 ordering violated: newest event (« $ressentiSummary », y=$ressentiY) " +
                "should render above older event (« $etatSummary », y=$etatY)",
            ressentiY < etatY,
        )
    }

    /**
     * FCH-08 — a contact who hasn't joined swab (`targetId = null`, which is
     * every manually-added contact today: contact discovery has no Android
     * client yet, see VaultContact.targetId's doc) still gets a full fiche:
     * the pending state is labeled, envie eligibility reads inactive, and the
     * axes remain genuinely editable (a real état edit lands and records).
     */
    @Test
    fun test_FCH08_pendingContact_ficheFullyEditable_envieInactive() {
        onboardAndOpenSamFiche()

        // Pending state clearly indicated (both lines render iff targetId == null).
        composeTestRule.onNodeWithText(Fr.FICHE_PENDING_LABEL).assertIsDisplayed()
        composeTestRule.onNodeWithText(Fr.FICHE_ENVIE_INACTIVE).assertIsDisplayed()

        // Axes stay fully editable despite the pending state: a real edit
        // selects, persists to the vault, and feeds the history (FCH-01/04
        // machinery working for a pending contact, not a read-only fiche).
        composeTestRule.onNodeWithText(Fr.ETAT_BUSY).performClick()
        composeTestRule.waitUntilSelected(Fr.ETAT_BUSY)
        composeTestRule.onNodeWithText(Fr.ETAT_BUSY).assertIsSelected()
        composeTestRule.waitUntilTextExists("${Fr.FICHE_AXIS_ETAT} → ${Fr.ETAT_BUSY}")
    }
}
