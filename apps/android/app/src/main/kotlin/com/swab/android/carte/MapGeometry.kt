package com.swab.android.carte

import kotlin.math.cos
import kotlin.math.sin

/**
 * FS-02 radial geometry — pure math, no Android/Compose imports (MAP-01/07).
 * Verbatim behavior port of apps/mobile/src/map/geometry.ts so both the
 * radial canvas and (if ever needed) a future calibration screen share one
 * spatial truth. JVM-testable without an emulator; see MapGeometryTest.
 */
object MapGeometry {
    const val MAP_SIZE: Float = 320f

    val RINGS: List<Int> = listOf(1, 2, 3, 4)

    /** Chip offsets used by [positionOn] (half the calibrate chip footprint). */
    const val NODE_HALF_WIDTH: Float = 28f
    const val NODE_HALF_HEIGHT: Float = 14f

    /** Golden angle in radians — deterministic angular spread per ring, no overlap clumping. */
    private const val GOLDEN_ANGLE: Double = 2.399963

    data class Position(val top: Float, val left: Float)

    fun ringRadius(ring: Int): Float = (MAP_SIZE / 2f) * (ring / 4.6f) + 24f

    /** Deterministic position for the index-th contact on a ring — same call, same answer. */
    fun positionOn(ring: Int, index: Int): Position {
        val angle = index * GOLDEN_ANGLE
        val r = ringRadius(ring)
        val left = (MAP_SIZE / 2f + r * cos(angle).toFloat() - NODE_HALF_WIDTH)
        val top = (MAP_SIZE / 2f + r * sin(angle).toFloat() - NODE_HALF_HEIGHT)
        return Position(top = top, left = left)
    }

    /** Bound a value into [lo, hi]. */
    fun clamp(value: Float, lo: Float, hi: Float): Float = value.coerceIn(lo, hi)

    /**
     * Max pan offset (either axis) at a given zoom: the scaled map's overflow
     * on one side. Zero at rest — the map cannot be pushed off-screen.
     */
    fun panBound(scale: Float): Float = maxOf(0f, (MAP_SIZE * (scale - 1f)) / 2f)

    /** Node diameter steps down with distance: closer reads bigger (MAP-03). */
    fun nodeSize(ring: Int): Float = 44f - (ring - 1) * 4f
}
