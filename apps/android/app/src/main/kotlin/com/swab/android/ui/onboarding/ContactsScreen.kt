package com.swab.android.ui.onboarding

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.swab.android.l10n.Fr
import com.swab.android.onboarding.ContactsViewModel

/**
 * ONB-03: manual add always available; « Passer » skips with no penalty.
 * Device-contact import (permission-gated) is wired at the Activity/Screen
 * host level and calls [ContactsViewModel.addFromDevice] — kept out of this
 * composable to keep it Activity-permission-free and previewable.
 */
@Composable
fun ContactsScreen(
    viewModel: ContactsViewModel,
    onImportContacts: () -> Unit,
    onContinue: () -> Unit,
) {
    val contacts by viewModel.contacts.collectAsState()
    var manualName by remember { mutableStateOf("") }

    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.CONTACTS_TITLE)
        BodyText(Fr.CONTACTS_HINT)
        GhostButton(Fr.CONTACTS_IMPORT, onClick = onImportContacts)
        InputField(value = manualName, placeholder = Fr.CONTACTS_MANUAL_PLACEHOLDER, onValueChange = { manualName = it })
        GhostButton(Fr.CONTACTS_ADD, onClick = { viewModel.addManual(manualName); manualName = "" })
        if (contacts.isNotEmpty()) {
            BodyText(contacts.joinToString(" · ") { it.displayName })
            PrimaryButton(Fr.CONTACTS_CONTINUE, onClick = onContinue)
        } else {
            GhostButton(Fr.CONTACTS_SKIP, onClick = onContinue)
        }
    }
}
