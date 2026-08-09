package com.swab.android.onboarding

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.swab.android.l10n.Fr
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.ui.onboarding.ContactsScreen
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * SUG-AND-005 — ONB-03's graceful-denial path: renders [ContactsScreen]
 * directly (no full [com.swab.android.MainActivity], no permission dialog
 * needed) with `deniedVisible = true` and asserts [Fr.CONTACTS_DENIED]
 * appears. The actual `READ_CONTACTS` denial -> `deniedVisible` wiring lives
 * in MainActivity and can't be driven headlessly (system permission
 * dialogs aren't Compose UI) — verified manually instead.
 */
@RunWith(AndroidJUnit4::class)
class ContactsScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun test_ONB03_deniedVisible_rendersGracefulDenialCopy() {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val viewModel = ContactsViewModel(vault)

        composeTestRule.setContent {
            ContactsScreen(
                viewModel = viewModel,
                onImportContacts = {},
                onContinue = {},
                deniedVisible = true,
            )
        }

        composeTestRule.onNodeWithText(Fr.CONTACTS_DENIED).assertExists()
    }

    @Test
    fun test_ONB03_deniedVisible_false_hidesDenialCopy() {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val viewModel = ContactsViewModel(vault)

        composeTestRule.setContent {
            ContactsScreen(
                viewModel = viewModel,
                onImportContacts = {},
                onContinue = {},
                deniedVisible = false,
            )
        }

        composeTestRule.onNodeWithText(Fr.CONTACTS_DENIED).assertDoesNotExist()
    }
}
