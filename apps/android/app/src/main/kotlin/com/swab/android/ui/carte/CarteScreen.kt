package com.swab.android.ui.carte

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.swab.android.carte.CarteViewModel
import com.swab.android.carte.EtatColors
import com.swab.android.l10n.Fr

/**
 * FS-02 « Ma carte » — the app's home. Renders entirely from the vault
 * (MAP-01/05): [LaunchedEffect] reloads on entering composition, mirroring
 * the RN reference's useFocusEffect so an FS-03 re-tag shows the contact on
 * its new ring on return. List mode (MAP-08) is feature-equivalent;
 * unplaced contacts stay visible in a tray — nothing hidden (MAP-06/09).
 */
@Composable
fun CarteScreen(viewModel: CarteViewModel) {
    val contacts by viewModel.contacts.collectAsState()
    val listMode by viewModel.listMode.collectAsState()
    val legendOpen by viewModel.legendOpen.collectAsState()
    val selected by viewModel.selected.collectAsState()

    LaunchedEffect(Unit) { viewModel.refresh() }

    val unplaced = contacts.filter { it.ring == null }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(Fr.CARTE_TITLE, style = MaterialTheme.typography.headlineSmall)
        Text(Fr.CARTE_SUBTITLE, style = MaterialTheme.typography.bodyMedium)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(Fr.CARTE_LIST_MODE, style = MaterialTheme.typography.bodyMedium)
            Switch(
                checked = listMode,
                onCheckedChange = viewModel::setListMode,
                modifier = Modifier.semantics { contentDescription = Fr.CARTE_LIST_MODE },
            )
        }

        if (listMode) {
            RingList(
                contacts = contacts,
                onPressContact = viewModel::selectContact,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                RadialMap(
                    contacts = contacts,
                    onPressContact = viewModel::selectContact,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
                if (contacts.isEmpty()) {
                    Text(Fr.CARTE_EMPTY, style = MaterialTheme.typography.bodyMedium)
                }
                if (unplaced.isNotEmpty()) {
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        for (contact in unplaced) {
                            TextButton(onClick = { viewModel.selectContact(contact) }) {
                                Text(contact.displayName)
                            }
                        }
                    }
                }
            }
        }

        TextButton(
            onClick = viewModel::toggleLegend,
            modifier = Modifier.semantics { contentDescription = Fr.CARTE_LEGEND },
        ) {
            Text(Fr.CARTE_LEGEND)
        }
        if (legendOpen) {
            LegendRow()
        }
    }

    PeekSheet(contact = selected, onDismiss = viewModel::clearSelection)
}

/** MAP-03 legend: explains the état colors — toggled, never shown unasked. */
@Composable
private fun LegendRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        for ((etat, hex) in EtatColors.ETAT_COLORS) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(hexToColor(hex)),
                )
                Text(etat, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
