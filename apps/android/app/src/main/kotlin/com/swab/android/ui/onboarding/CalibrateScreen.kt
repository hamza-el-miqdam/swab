package com.swab.android.ui.onboarding

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.Switch
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import com.swab.android.l10n.Fr
import com.swab.android.onboarding.CalibrateViewModel

private val RING_LABELS = mapOf(1 to Fr.RING_1, 2 to Fr.RING_2, 3 to Fr.RING_3, 4 to Fr.RING_4)
private val ETATS = listOf(Fr.ETAT_AVAILABLE, Fr.ETAT_BUSY, Fr.ETAT_AWAY)
private val RESSENTIS = listOf(Fr.RESSENTI_LIGHT, Fr.RESSENTI_PRECIOUS, Fr.RESSENTI_PAUSED)

/**
 * ONB-04/05/06: radial calibration. v0 keeps a list-mode toggle (accessible
 * fallback, non-functional spec requirement) as the primary interaction —
 * the true radial canvas ships with FS-02 (Wave 2), same as the RN reference
 * ("v0 interaction is tap-to-select + tap-ring-to-place").
 */
@Composable
fun CalibrateScreen(viewModel: CalibrateViewModel, onContinue: () -> Unit) {
    val contacts by viewModel.contacts.collectAsState()
    val selectedId by viewModel.selectedId.collectAsState()
    var optionalOpen by remember { mutableStateOf(false) } // ONB-06: collapsed by default

    OnboardingScreen {
        Brand()
        ScreenTitle(Fr.CALIBRATE_TITLE)
        BodyText(Fr.CALIBRATE_HINT)

        if (contacts.isEmpty()) {
            BodyText(Fr.CALIBRATE_EMPTY)
        }

        for (contact in contacts) {
            val ringLabel = contact.ring?.let { RING_LABELS[it] } ?: "—"
            Row(horizontalArrangement = Arrangement.SpaceBetween) {
                GhostButton("${contact.displayName} — $ringLabel", onClick = { viewModel.select(contact.id) })
            }
            if (selectedId == contact.id) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (etat in ETATS) {
                        GhostButton(etat, onClick = { viewModel.setEtatForSelected(etat) })
                    }
                }
                BodyText(Fr.CALIBRATE_RESSENTI_TITLE)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (ressenti in RESSENTIS) {
                        GhostButton(ressenti, onClick = { viewModel.setRessentiForSelected(ressenti) })
                    }
                }
            }
        }

        PrimaryButton(Fr.CALIBRATE_CONTINUE, onClick = onContinue)
    }
}
