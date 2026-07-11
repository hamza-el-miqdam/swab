package com.swab.android.ui.carte

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.swab.android.carte.EtatColors
import com.swab.android.carte.Labels
import com.swab.android.carte.MapGeometry
import com.swab.android.l10n.Fr
import com.swab.android.vault.VaultContact
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.PI

private const val MIN_SCALE = 1f
private const val MAX_SCALE = 3f
private val SPOKE_ANGLES = listOf(0f, 45f, 90f, 135f)
private const val MOVE_MS = 350

/**
 * MAP-01/03/07 — the radial canvas: ring circles + hairline spokes drawn in
 * ONE [Canvas] (android-specialist.md perf rule: not one composable per
 * ring), « moi » centered, one lightweight node composable per PLACED
 * contact (needs its own tap target + TalkBack label + independent move
 * animation, same reasoning as the RN reference's ContactNode). Pinch-zoom
 * (1x-3x) + pan bounded by [MapGeometry.panBound] via `detectTransformGestures`.
 * Pure presentation from vault data passed in — this module never loads
 * anything (MAP-05).
 */
@Composable
fun RadialMap(
    contacts: List<VaultContact>,
    onPressContact: (VaultContact) -> Unit,
    modifier: Modifier = Modifier,
) {
    // MapGeometry's numbers are already dp-equivalent units (a 320-unit
    // canvas is meant to render as a 320dp box, matching the RN reference's
    // MAP_SIZE), so wrap with `.dp` directly — NOT `Float.toDp()`, which
    // treats the input as raw device pixels and divides by density,
    // shrinking the whole map (found live on a 3.5x-density Pixel 6 Pro
    // emulator: the map collapsed to ~1/3.5 size while `moi`'s hardcoded
    // 44.dp did not, making placed nodes appear to overlap `moi`).
    val mapSizeDp = MapGeometry.MAP_SIZE.dp

    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    val placed = remember(contacts) {
        val perRing = mutableMapOf<Int, Int>()
        contacts.filter { it.ring != null }.map { contact ->
            val ring = contact.ring!!
            val index = perRing.getOrDefault(ring, 0)
            perRing[ring] = index + 1
            contact to index
        }
    }

    Box(
        modifier = modifier
            .size(mapSizeDp)
            .pointerInput(Unit) {
                // `pan` from detectTransformGestures and translationX/Y on
                // graphicsLayer are both raw PIXELS; panBound is in
                // dp-equivalent units, so it's scaled by this
                // PointerInputScope's own `density` (px = dp * density)
                // before being used as a pixel clamp — same fix as the
                // Canvas/ContactNode density mismatch above.
                detectTransformGestures { _, pan, zoom, _ ->
                    val newScale = MapGeometry.clamp(scale * zoom, MIN_SCALE, MAX_SCALE)
                    val bound = MapGeometry.panBound(newScale) * density
                    scale = newScale
                    offsetX = MapGeometry.clamp(offsetX + pan.x, -bound, bound)
                    offsetY = MapGeometry.clamp(offsetY + pan.y, -bound, bound)
                }
            },
    ) {
        Box(
            modifier = Modifier
                .size(mapSizeDp)
                .graphicsLayer(
                    scaleX = scale,
                    scaleY = scale,
                    translationX = offsetX,
                    translationY = offsetY,
                ),
        ) {
            RingsAndSpokes(modifier = Modifier.size(mapSizeDp))

            MeNode(modifier = Modifier.align(Alignment.Center))

            for ((contact, index) in placed) {
                key(contact.id) {
                    ContactNode(
                        contact = contact,
                        index = index,
                        onPress = onPressContact,
                    )
                }
            }
        }
    }
}

/**
 * Ring circles + spokes — decorative, non-interactive, drawn once per frame
 * in one Canvas. A `Canvas` DrawScope draws in raw PIXELS, while
 * [MapGeometry]'s numbers are dp-equivalent units, so every value from it is
 * multiplied by this DrawScope's own `density` (px = dp * density) before
 * being handed to `drawCircle`/`drawLine` — the same fix as [ContactNode]'s
 * positioning, applied on the pixel side instead of the dp side.
 */
@Composable
private fun RingsAndSpokes(modifier: Modifier = Modifier) {
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

@Composable
private fun MeNode(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary)
            .semantics { contentDescription = Fr.CARTE_ME },
        contentAlignment = Alignment.Center,
    ) {
        Text(Fr.CARTE_ME, color = MaterialTheme.colorScheme.onPrimary, fontSize = 13.sp)
    }
}

/**
 * MAP-01/03/04 — one contact on the map. Position animates (~350ms) when the
 * ring/index changes; the very first mount snaps into place — only changes
 * animate (RN reference's `mounted` ref pattern, ported here as a
 * per-contact-id entry in a remembered map so it survives recomposition but
 * resets on a fresh RadialMap composition, e.g. re-entering the carte).
 */
@Composable
private fun ContactNode(
    contact: VaultContact,
    index: Int,
    onPress: (VaultContact) -> Unit,
) {
    val ring = contact.ring ?: return
    val position = MapGeometry.positionOn(ring, index)
    val size = MapGeometry.nodeSize(ring)
    val centerX = position.left + MapGeometry.NODE_HALF_WIDTH
    val centerY = position.top + MapGeometry.NODE_HALF_HEIGHT
    val left = centerX - size / 2f
    val top = centerY - size / 2f

    // First mount for this contact id snaps in place; only later moves
    // (a ring/index change) animate — the RN reference's `mounted` ref.
    var hasMounted by remember(contact.id) { mutableStateOf(false) }

    val x = remember(contact.id) { Animatable(left) }
    val y = remember(contact.id) { Animatable(top) }

    LaunchedEffect(contact.id, left, top) {
        if (!hasMounted) {
            hasMounted = true
            x.snapTo(left)
            y.snapTo(top)
        } else {
            x.animateTo(left, animationSpec = tween(MOVE_MS))
            y.animateTo(top, animationSpec = tween(MOVE_MS))
        }
    }

    val palette = EtatColors.etatColor(contact.etat)
    val background = palette.background?.let(::hexToColor) ?: MaterialTheme.colorScheme.surface
    val border = palette.border?.let(::hexToColor) ?: MaterialTheme.colorScheme.outlineVariant

    // dp-equivalent units, wrapped directly (see RadialMap's mapSizeDp comment).
    val leftDp = x.value.dp
    val topDp = y.value.dp
    val sizeDp = size.dp

    Box(
        modifier = Modifier
            .offset(x = leftDp, y = topDp)
            .size(sizeDp)
            .clip(CircleShape)
            .background(background)
            .border(1.dp, border, CircleShape)
            .semantics {
                role = Role.Button
                contentDescription = Labels.contactLabel(contact)
            }
            .pointerInput(contact.id) {
                detectTapGestures(onTap = { onPress(contact) })
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(Labels.initials(contact.displayName), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
    }
}
