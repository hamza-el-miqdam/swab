package com.swab.android.ui.carte

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Alignment
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.swab.android.carte.EtatColors
import com.swab.android.carte.Labels
import com.swab.android.l10n.Fr
import com.swab.android.vault.VaultContact

private const val UNSET = "—" // quiet dash, not copy: an axis simply not filled in yet

/**
 * MAP-04 — tap a contact, read Intimité / État / Rôles. Uses Material 3's
 * [ModalBottomSheet] (already in build.gradle.kts via the compose-bom — no
 * new dependency, G4). « Ouvrir la fiche » now navigates to the FS-03 fiche
 * screen via [onOpenFiche] — the button was rendered visibly disabled while
 * that screen didn't exist yet (Wave 2); it's wired live as of FS-03.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PeekSheet(contact: VaultContact?, onDismiss: () -> Unit, onOpenFiche: (VaultContact) -> Unit) {
    if (contact == null) return

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState()) {
        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val swatch = EtatColors.etatColor(contact.etat)
                val dotColor = swatch.background?.let(::hexToColor) ?: MaterialTheme.colorScheme.outlineVariant
                Box(
                    modifier = Modifier
                        .padding(end = 8.dp)
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(dotColor),
                )
                Text(contact.displayName, style = MaterialTheme.typography.headlineSmall)
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            PeekRow(Fr.CARTE_SHEET_INTIMITE, contact.ring?.let { Labels.RING_LABEL[it] } ?: UNSET)
            PeekRow(Fr.CARTE_SHEET_ETAT, contact.etat ?: UNSET)
            PeekRow(Fr.CARTE_SHEET_ROLES, contact.roles.takeIf { it.isNotEmpty() }?.joinToString(" · ") ?: UNSET)
            OutlinedButton(
                onClick = { onOpenFiche(contact) },
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp, bottom = 24.dp)
                    .semantics {
                        contentDescription = Fr.CARTE_OPEN_FICHE
                    },
            ) {
                Text(Fr.CARTE_OPEN_FICHE)
            }
        }
    }
}

@Composable
private fun PeekRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}
