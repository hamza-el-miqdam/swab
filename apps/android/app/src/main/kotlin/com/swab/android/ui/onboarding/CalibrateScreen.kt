package com.swab.android.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Switch
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.swab.android.l10n.Fr
import com.swab.android.onboarding.CalibrateViewModel

private val RING_LABELS = mapOf(1 to Fr.RING_1, 2 to Fr.RING_2, 3 to Fr.RING_3, 4 to Fr.RING_4)
// OQ-FCH-2 (resolved 2026-08-09, issue #16): État carries 4 values (`en
// pause` moved here from Ressenti). OQ-FCH-1 (resolved 2026-08-09, issue
// #15): Ressenti carries the 3 real values from the blueprint's VALENCES
// const, replacing the léger/précieux placeholder pair entirely.
private val ETATS = listOf(Fr.ETAT_AVAILABLE, Fr.ETAT_BUSY, Fr.ETAT_AWAY, Fr.ETAT_PAUSED)
private val RESSENTIS = listOf(Fr.RESSENTI_POSITIVE, Fr.RESSENTI_AMBIVALENT, Fr.RESSENTI_NEGATIVE)

/**
 * ONB-04/05/06: radial calibration. SUG-AND-014: the canvas
 * ([CalibrateRadial]) visually prefigures the FS-02 map by default — « moi »
 * centered, placed contacts as ring nodes, unplaced contacts in a tray below.
 * The full text roster + per-ring `GhostButton`s beneath it are the
 * always-available accessible path (both wire into the same
 * select/placeSelectedOnRing calls, so screen-reader and sighted flows stay
 * in lockstep); [Fr.CALIBRATE_LIST_MODE] hides the canvas for a leaner
 * TalkBack-only screen — v0 interaction is tap-to-select + tap-ring-to-place,
 * same as the RN reference.
 */
@Composable
fun CalibrateScreen(viewModel: CalibrateViewModel, onContinue: () -> Unit) {
    val contacts by viewModel.contacts.collectAsState()
    val selectedId by viewModel.selectedId.collectAsState()
    var optionalOpen by remember { mutableStateOf(false) } // ONB-06: collapsed by default
    var listMode by remember { mutableStateOf(false) } // ONB-04: radial canvas is the default

    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.CALIBRATE_TITLE)
        BodyText(Fr.CALIBRATE_HINT)

        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BodyText(Fr.CALIBRATE_LIST_MODE)
            Switch(
                checked = listMode,
                onCheckedChange = { listMode = it },
                modifier = Modifier.semantics { contentDescription = Fr.CALIBRATE_LIST_MODE },
            )
        }

        if (contacts.isEmpty()) {
            BodyText(Fr.CALIBRATE_EMPTY)
        }

        if (!listMode) {
            CalibrateRadial(
                contacts = contacts,
                selectedId = selectedId,
                onSelectContact = viewModel::select,
                onPlaceOnRing = viewModel::placeSelectedOnRing,
            )
        }

        for (contact in contacts) {
            val ringLabel = contact.ring?.let { RING_LABELS[it] } ?: "—"
            Row(horizontalArrangement = Arrangement.SpaceBetween) {
                GhostButton("${contact.displayName} — $ringLabel", onClick = { viewModel.select(contact.id) })
            }
            if (selectedId == contact.id) {
                // SUG-AND-002: four ring buttons with long French labels
                // overflow a plain Row (rings 3/4 were unreachable on-device
                // — the known "CalibrateScreen layout bug"). A full-width
                // Column wraps every label without truncation and needs no
                // new API/dependency.
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for ((ring, label) in RING_LABELS) {
                        GhostButton("${Fr.CALIBRATE_RING_PREFIX} $ring — $label") {
                            viewModel.placeSelectedOnRing(ring)
                        }
                    }
                }
            }
        }

        // ONB-06: optional layer, collapsed by default, never blocking.
        GhostButton(Fr.CALIBRATE_OPTIONAL_LAYER, onClick = { optionalOpen = !optionalOpen })
        if (optionalOpen) {
            if (selectedId == null) {
                BodyText(Fr.CALIBRATE_OPTIONAL_HINT)
            } else {
                BodyText(Fr.CALIBRATE_ETAT_TITLE)
                // SUG-AND-002: same overflow risk as the ring row (ETATS now
                // has 4 values since OQ-FCH-2) — Column avoids it.
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (etat in ETATS) {
                        GhostButton(etat, onClick = { viewModel.setEtatForSelected(etat) })
                    }
                }
                BodyText(Fr.CALIBRATE_RESSENTI_TITLE)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (ressenti in RESSENTIS) {
                        GhostButton(ressenti, onClick = { viewModel.setRessentiForSelected(ressenti) })
                    }
                }
            }
        }

        PrimaryButton(Fr.CALIBRATE_CONTINUE, onClick = onContinue)
    }
}
