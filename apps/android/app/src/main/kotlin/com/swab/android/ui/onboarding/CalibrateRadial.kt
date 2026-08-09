package com.swab.android.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.swab.android.carte.Labels
import com.swab.android.carte.MapGeometry
import com.swab.android.l10n.Fr
import com.swab.android.ui.carte.MeNode
import com.swab.android.ui.carte.RingsAndSpokes
import com.swab.android.vault.VaultContact
import kotlin.math.hypot

/**
 * ONB-04 — radial calibration canvas: reuses [MapGeometry]/[RingsAndSpokes]/
 * [MeNode] from FS-02's carte so the two screens share one spatial truth and
 * calibration visually prefigures the map, per spec. Interaction is
 * tap-to-select + tap-ring-to-place: tapping a tray chip or a placed node
 * selects a contact; while one is selected, tapping anywhere on the canvas
 * resolves to the nearest ring via [MapGeometry.ringForDistance] and places
 * it there. The per-ring `GhostButton`s under this composable (rendered by
 * the caller, [CalibrateScreen]) remain the always-available accessible path
 * — this canvas is a visual/pointer enhancement, not a replacement.
 */
@Composable
fun CalibrateRadial(
    contacts: List<VaultContact>,
    selectedId: String?,
    onSelectContact: (String) -> Unit,
    onPlaceOnRing: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val mapSizeDp = MapGeometry.MAP_SIZE.dp

    val placed = remember(contacts) {
        val perRing = mutableMapOf<Int, Int>()
        contacts.filter { it.ring != null }.map { contact ->
            val ring = contact.ring!!
            val index = perRing.getOrDefault(ring, 0)
            perRing[ring] = index + 1
            contact to index
        }
    }
    val unplaced = contacts.filter { it.ring == null }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
            modifier = modifier
                .size(mapSizeDp)
                .pointerInput(selectedId) {
                    if (selectedId == null) return@pointerInput
                    detectTapGestures { offset ->
                        val centerX = size.width / 2f
                        val centerY = size.height / 2f
                        val distancePx = hypot(offset.x - centerX, offset.y - centerY)
                        val distanceDp = distancePx / density
                        MapGeometry.ringForDistance(distanceDp)?.let { ring -> onPlaceOnRing(ring) }
                    }
                },
        ) {
            RingsAndSpokes(modifier = Modifier.size(mapSizeDp))
            MeNode(modifier = Modifier.align(Alignment.Center), label = Fr.CALIBRATE_ME)

            for ((contact, index) in placed) {
                key(contact.id) {
                    CalibrateNode(
                        contact = contact,
                        index = index,
                        selected = contact.id == selectedId,
                        onPress = { onSelectContact(contact.id) },
                    )
                }
            }
        }

        if (unplaced.isNotEmpty()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (contact in unplaced) {
                    val selected = contact.id == selectedId
                    TextButton(onClick = { onSelectContact(contact.id) }) {
                        Text(if (selected) "• ${contact.displayName}" else contact.displayName)
                    }
                }
            }
        }
    }
}

/**
 * One contact node on the calibration canvas. Unlike [com.swab.android.ui.carte.RadialMap]'s
 * `ContactNode`, this one has no état color or move animation — the
 * calibration canvas is static (no pan/zoom, FS-01 non-functional
 * requirement), and état/ressenti are set in the optional layer below, not
 * shown here.
 */
@Composable
private fun CalibrateNode(
    contact: VaultContact,
    index: Int,
    selected: Boolean,
    onPress: () -> Unit,
) {
    val ring = contact.ring ?: return
    val position = MapGeometry.positionOn(ring, index)
    val size = MapGeometry.nodeSize(ring)
    val centerX = position.left + MapGeometry.NODE_HALF_WIDTH
    val centerY = position.top + MapGeometry.NODE_HALF_HEIGHT
    val leftDp = (centerX - size / 2f).dp
    val topDp = (centerY - size / 2f).dp
    val sizeDp = size.dp

    val borderColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    val borderWidth = if (selected) 2.dp else 1.dp

    Box(
        modifier = Modifier
            .offset(x = leftDp, y = topDp)
            .size(sizeDp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surface)
            .border(borderWidth, borderColor, CircleShape)
            // `clickable` (not raw pointerInput+detectTapGestures) registers
            // a real OnClick semantics action so TalkBack double-tap works —
            // written this way from the start (the bug SUG-AND-008 fixes on
            // RadialMap's ContactNode never existed here).
            .clickable(onClick = onPress, role = Role.Button)
            .semantics { contentDescription = Labels.contactLabel(contact) },
        contentAlignment = Alignment.Center,
    ) {
        Text(Labels.initials(contact.displayName), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
    }
}
