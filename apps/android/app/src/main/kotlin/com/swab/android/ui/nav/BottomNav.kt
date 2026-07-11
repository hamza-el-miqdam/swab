package com.swab.android.ui.nav

import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import com.swab.android.l10n.Fr

/**
 * MAP-02 — the app's persistent navigation: exactly Carte / Envie /
 * Sous-groupes. This file renders a `label` per item and nothing else — no
 * numeric indicator of any kind is used anywhere here, so it is impossible
 * by construction (product law 5), matching the RN reference's
 * src/ui/nav-bar.tsx.
 */
enum class MainDestination(val route: String, val label: String) {
    CARTE("carte", Fr.NAV_CARTE),
    ENVIE("envie", Fr.NAV_ENVIE),
    SOUS_GROUPES("sous-groupes", Fr.NAV_SOUS_GROUPES),
}

@Composable
fun SwabBottomNav(current: MainDestination, onSelect: (MainDestination) -> Unit) {
    NavigationBar {
        for (destination in MainDestination.entries) {
            val selected = destination == current
            NavigationBarItem(
                selected = selected,
                onClick = { if (!selected) onSelect(destination) },
                label = { Text(destination.label) },
                icon = {},
                modifier = Modifier.semantics {
                    role = Role.Tab
                    contentDescription = destination.label
                    this.selected = selected
                },
            )
        }
    }
}
