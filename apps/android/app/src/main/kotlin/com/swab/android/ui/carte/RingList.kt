package com.swab.android.ui.carte

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.swab.android.carte.EtatColors
import com.swab.android.carte.Labels
import com.swab.android.carte.MapGeometry
import com.swab.android.vault.VaultContact

private data class RingSection(val title: String?, val data: List<VaultContact>)

private fun buildSections(contacts: List<VaultContact>): List<RingSection> {
    val sections = MapGeometry.RINGS.map { ring ->
        RingSection(Labels.RING_LABEL[ring], contacts.filter { it.ring == ring })
    }.toMutableList()
    val unplaced = contacts.filter { it.ring == null }
    if (unplaced.isNotEmpty()) {
        sections += RingSection(null, unplaced)
    }
    return sections.filter { it.data.isNotEmpty() }
}

/**
 * MAP-08 — the accessibility fallback: a LazyColumn grouped by ring,
 * feature-equivalent to the radial view (same label vocabulary via
 * [Labels.contactLabel], same press action). Unplaced contacts get their
 * own trailing, untitled section so nothing is hidden from TalkBack users
 * either.
 */
@Composable
fun RingList(contacts: List<VaultContact>, onPressContact: (VaultContact) -> Unit, modifier: Modifier = Modifier) {
    val sections = buildSections(contacts)
    LazyColumn(modifier = modifier) {
        for (section in sections) {
            if (section.title != null) {
                item {
                    Text(
                        section.title,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
                    )
                }
            }
            items(section.data, key = { it.id }) { contact ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onPressContact(contact) }
                        .semantics {
                            role = Role.Button
                            contentDescription = Labels.contactLabel(contact)
                        }
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val swatch = EtatColors.etatColor(contact.etat)
                    val color = swatch.background?.let(::hexToColor) ?: MaterialTheme.colorScheme.outlineVariant
                    Box(
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(color),
                    )
                    Text(contact.displayName, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}
