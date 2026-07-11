package com.swab.android.ui.fiche

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.swab.android.carte.Labels
import com.swab.android.fiche.FicheFilterConsequence
import com.swab.android.fiche.FicheViewModel
import com.swab.android.l10n.Fr
import com.swab.android.vault.VaultHistoryEvent
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// OQ-FCH-1 — placeholder Rôles·contexte taxonomy (this task's brief); no
// product decision on the final vocabulary yet.
private val ROLES = listOf(
    Fr.FICHE_ROLE_FAMILLE,
    Fr.FICHE_ROLE_AMITIE,
    Fr.FICHE_ROLE_TRAVAIL,
    Fr.FICHE_ROLE_VOISINAGE,
    Fr.FICHE_ROLE_AUTRE,
)

// Same shipped 3-value sets as CalibrateScreen.kt's private ETATS/RESSENTIS
// (ONB-04/06) — redefined here (not imported) because those lists aren't
// exported from that file, and this task's brief says reuse them, not invent
// a new vocabulary. Do not add values here without touching CalibrateScreen
// too, or the two screens will silently diverge.
private val ETATS = listOf(Fr.ETAT_AVAILABLE, Fr.ETAT_BUSY, Fr.ETAT_AWAY)
private val RESSENTIS = listOf(Fr.RESSENTI_LIGHT, Fr.RESSENTI_PRECIOUS, Fr.RESSENTI_PAUSED)

/**
 * FS-03 « Fiche contact » — the four tap-editable axes, the local history
 * feed (FCH-04), and the discreet staleness nudge (FCH-05). Renders entirely
 * from [FicheViewModel], which reads only the vault (FCH-01 offline/optimistic
 * writes) — never the network, enforced structurally by
 * FicheOfflineStructuralTest.
 */
@Composable
fun FicheScreen(viewModel: FicheViewModel, onBack: () -> Unit) {
    val contact by viewModel.contact.collectAsState()
    val history by viewModel.history.collectAsState()
    val staleNudgeVisible by viewModel.staleNudgeVisible.collectAsState()
    val c = contact ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        TextButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = Fr.FICHE_BACK }) {
            Text(Fr.FICHE_BACK)
        }

        Text(c.displayName, style = MaterialTheme.typography.headlineSmall)

        // FCH-08 — a pending contact (no ContactLink yet) still gets a full,
        // fully-editable fiche; only envie eligibility reads as inactive.
        if (c.targetId == null) {
            Text(Fr.FICHE_PENDING_LABEL, style = MaterialTheme.typography.bodySmall)
            Text(Fr.FICHE_ENVIE_INACTIVE, style = MaterialTheme.typography.bodySmall)
        }

        IntimiteAxis(ring = c.ring, onSelect = viewModel::setIntimite)
        RolesAxis(
            selected = c.roles,
            onToggle = { role ->
                val next = if (role in c.roles) c.roles - role else c.roles + role
                viewModel.setRoles(next)
            },
        )
        EtatAxis(etat = c.etat, onSelect = viewModel::setEtat)
        RessentiAxis(ressenti = c.ressenti, onSelect = viewModel::setRessenti)

        HorizontalDivider()
        Text(Fr.FICHE_HISTORY_TITLE, style = MaterialTheme.typography.titleMedium)
        if (history.isEmpty()) {
            Text(Fr.FICHE_HISTORY_EMPTY, style = MaterialTheme.typography.bodySmall)
        } else {
            for (event in history) {
                HistoryRow(event)
            }
        }

        if (staleNudgeVisible) {
            StaleNudge(onConfirm = viewModel::confirmStillAccurate, onDismiss = viewModel::dismissStaleNudge)
        }
    }
}

@Composable
private fun IntimiteAxis(ring: Int?, onSelect: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(Fr.FICHE_AXIS_INTIMITE, style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((r, label) in Labels.RING_LABEL) {
                FilterChip(selected = ring == r, onClick = { onSelect(r) }, label = { Text(label) })
            }
        }
    }
}

@Composable
private fun RolesAxis(selected: List<String>, onToggle: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(Fr.FICHE_AXIS_ROLES, style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (role in ROLES) {
                FilterChip(selected = role in selected, onClick = { onToggle(role) }, label = { Text(role) })
            }
        }
    }
}

@Composable
private fun EtatAxis(etat: String?, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(Fr.FICHE_AXIS_ETAT, style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (value in ETATS) {
                FilterChip(selected = etat == value, onClick = { onSelect(value) }, label = { Text(value) })
            }
        }
        FicheFilterConsequence.forValue(etat)?.let {
            Text(it, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun RessentiAxis(ressenti: String?, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(Fr.FICHE_AXIS_RESSENTI, style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (value in RESSENTIS) {
                FilterChip(selected = ressenti == value, onClick = { onSelect(value) }, label = { Text(value) })
            }
        }
        // FCH-06 — see FicheFilterConsequence's header comment for why this
        // axis is also checked: "en pause" ships under ressenti today, not état.
        FicheFilterConsequence.forValue(ressenti)?.let {
            Text(it, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun HistoryRow(event: VaultHistoryEvent) {
    val formatter = remember { SimpleDateFormat("d MMM yyyy", Locale.FRENCH) }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(event.summary, style = MaterialTheme.typography.bodyMedium)
        Text(formatter.format(Date(event.at)), style = MaterialTheme.typography.bodySmall)
    }
}

/**
 * FCH-05 — deliberately an inline [Card], never an AlertDialog/modal: « jamais
 * bloquant » per the spec. Exactly two actions, no third "close" affordance.
 */
@Composable
private fun StaleNudge(onConfirm: () -> Unit, onDismiss: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(Fr.FICHE_STALE_TITLE, style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onConfirm) { Text(Fr.FICHE_STALE_CONFIRM) }
                TextButton(onClick = onDismiss) { Text(Fr.FICHE_STALE_DISMISS) }
            }
        }
    }
}
