package com.swab.android.ui.carte

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.swab.android.carte.MapGeometry
import com.swab.android.l10n.Fr
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

private val SPOKE_ANGLES = listOf(0f, 45f, 90f, 135f)

/**
 * SUG-AND-014: the ring/spoke backdrop and the « moi » node, shared between
 * [RadialMap] (FS-02 carte) and `CalibrateRadial` (FS-01 ONB-04) so both
 * screens render one spatial truth — extracted verbatim out of RadialMap.kt,
 * no behavior change to the carte's rendering.
 */

/**
 * Ring circles + spokes — decorative, non-interactive, drawn once per frame
 * in one Canvas. A `Canvas` DrawScope draws in raw PIXELS, while
 * [MapGeometry]'s numbers are dp-equivalent units, so every value from it is
 * multiplied by this DrawScope's own `density` (px = dp * density) before
 * being handed to `drawCircle`/`drawLine` — the same fix as a node's
 * positioning, applied on the pixel side instead of the dp side.
 */
@Composable
internal fun RingsAndSpokes(modifier: Modifier = Modifier) {
    val lineColor = MaterialTheme.colorScheme.outlineVariant
    Canvas(modifier = modifier) {
        val center = Offset(size.width / 2f, size.height / 2f)
        for (ring in MapGeometry.RINGS) {
            val r = MapGeometry.ringRadius(ring) * density
            drawCircle(color = lineColor, radius = r, center = center, style = Stroke(width = 1f))
        }
        for (angleDeg in SPOKE_ANGLES) {
            val angle = angleDeg * (PI / 180.0)
            val dx = cos(angle).toFloat()
            val dy = sin(angle).toFloat()
            val half = (MapGeometry.MAP_SIZE / 2f) * density
            drawLine(
                color = lineColor.copy(alpha = 0.6f),
                start = Offset(center.x - dx * half, center.y - dy * half),
                end = Offset(center.x + dx * half, center.y + dy * half),
                strokeWidth = 1f,
            )
        }
    }
}

/** The center node representing the current user. [label] differs by screen
 * (Fr.CARTE_ME / Fr.CALIBRATE_ME — same "moi" value today, kept parameterized
 * rather than hardcoded so the two screens can't silently diverge). */
@Composable
internal fun MeNode(modifier: Modifier = Modifier, label: String = Fr.CARTE_ME) {
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = MaterialTheme.colorScheme.onPrimary, fontSize = 13.sp)
    }
}
