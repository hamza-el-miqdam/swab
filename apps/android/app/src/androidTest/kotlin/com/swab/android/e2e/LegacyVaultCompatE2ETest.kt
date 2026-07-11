package com.swab.android.e2e

import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.swab.android.E2ESeedHooks
import com.swab.android.MainActivity
import com.swab.android.l10n.Fr
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * FS-07 VLT-01 / FS-03 backward compatibility — Android twin of the iOS
 * `--uitesting-seed-legacy-vault` XCUITest: a vault blob written by a
 * PRE-FS-03 build (no `history` array, no `targetId` /
 * `lastAxisChangeAt` / `staleSnoozedUntil` fields on contacts — the on-disk
 * shape before commit 162b0c8) must still decrypt and decode after the
 * FS-03 schema growth, end-to-end through the real app: real
 * Android-Keystore-wrapped key, real `javax.crypto` AES-256-GCM decrypt,
 * real `kotlinx.serialization` decode (`ignoreUnknownKeys` + defaulted new
 * fields — the contract the Wave 3 commit promised, verified at the unit
 * level then; here it's proven on-device against the launch path).
 *
 * Seeding happens through [E2ESeedHooks] (debug-source-set-only; see its
 * header for the release-safety argument), triggered by an Intent extra —
 * which is why this test uses [createEmptyComposeRule] + a manual
 * [ActivityScenario.launch] instead of `createAndroidComposeRule`
 * (the latter launches with a default Intent before the test body runs,
 * too early to attach the extra).
 */
@RunWith(AndroidJUnit4::class)
class LegacyVaultCompatE2ETest {

    @get:Rule
    val composeTestRule = createEmptyComposeRule()

    @Test
    fun test_VLT01_FCH01_08_legacyPreFs03VaultBlob_loadsToCarte_contactsRenderAndFicheOpens() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(E2ESeedHooks.EXTRA_SEED_LEGACY_VAULT, true)

        ActivityScenario.launch<MainActivity>(intent).use {
            // App reaches Carte (seeded onboarding step = complete, ONB-08
            // resume gate) WITHOUT crashing on the legacy blob decode…
            composeTestRule.waitUntilTextExists(Fr.CARTE_TITLE)

            // …and the legacy contact actually renders on its ring — i.e.
            // the blob was genuinely decrypted and decoded, not skipped.
            val legacyLabel = "Contact Historique — ${Fr.RING_1}"
            composeTestRule.waitUntilContentDescriptionExists(legacyLabel)
            composeTestRule.onNodeWithContentDescription(legacyLabel).assertIsDisplayed()

            // The FS-03 surface built on the NEW fields also copes with their
            // absence: the fiche opens, the missing `history` reads as the
            // empty feed, and the missing `targetId` reads as pending
            // (FCH-08) — instead of any of them throwing.
            composeTestRule.onNodeWithContentDescription(legacyLabel).performClick()
            composeTestRule.waitUntilContentDescriptionExists(Fr.CARTE_OPEN_FICHE)
            composeTestRule.onNodeWithContentDescription(Fr.CARTE_OPEN_FICHE).performClick()

            composeTestRule.waitUntilTextExists(Fr.FICHE_HISTORY_TITLE)
            composeTestRule.onNodeWithText("Contact Historique").assertIsDisplayed()
            composeTestRule.onNodeWithText(Fr.FICHE_PENDING_LABEL).assertIsDisplayed()
            composeTestRule.onNodeWithText(Fr.FICHE_HISTORY_EMPTY).assertExists()
        }
    }
}
