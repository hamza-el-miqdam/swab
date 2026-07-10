package com.swab.android.carte

import kotlin.math.hypot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MAP-01/07 — radial geometry stays sane at density: 150 contacts per ring
 * produce finite, deterministic, in-canvas positions. Plus the pure
 * pan/zoom clamp helpers. Mirrors
 * apps/mobile/src/__tests__/map-geometry.map07.test.ts exactly (same
 * tolerances, same assertions) so both platforms share one spatial truth.
 */
class MapGeometryTest {

    private val density = 150
    // ringRadius(4) slightly exceeds MAP_SIZE/2 by design (chips hug the
    // edge); allow a 5% margin rather than pretending the canvas is a hard wall.
    private val canvasTolerance = MapGeometry.MAP_SIZE * 0.05f

    @Test
    fun `MAP-07 ring 1 150 positions are finite, deterministic, and on the ring`() {
        assertRingDensity(1)
    }

    @Test
    fun `MAP-07 ring 2 150 positions are finite, deterministic, and on the ring`() {
        assertRingDensity(2)
    }

    @Test
    fun `MAP-07 ring 3 150 positions are finite, deterministic, and on the ring`() {
        assertRingDensity(3)
    }

    @Test
    fun `MAP-07 ring 4 150 positions are finite, deterministic, and on the ring`() {
        assertRingDensity(4)
    }

    private fun assertRingDensity(ring: Int) {
        for (i in 0 until density) {
            val a = MapGeometry.positionOn(ring, i)
            val b = MapGeometry.positionOn(ring, i)
            assertEquals("deterministic — same call, same answer", a, b)

            assertTrue("left is finite", a.left.isFinite())
            assertTrue("top is finite", a.top.isFinite())

            val cx = a.left + MapGeometry.NODE_HALF_WIDTH
            val cy = a.top + MapGeometry.NODE_HALF_HEIGHT
            val r = hypot((cx - MapGeometry.MAP_SIZE / 2f).toDouble(), (cy - MapGeometry.MAP_SIZE / 2f).toDouble())
            assertEquals(MapGeometry.ringRadius(ring).toDouble(), r, 1e-4)

            assertTrue(cx >= -canvasTolerance)
            assertTrue(cx <= MapGeometry.MAP_SIZE + canvasTolerance)
            assertTrue(cy >= -canvasTolerance)
            assertTrue(cy <= MapGeometry.MAP_SIZE + canvasTolerance)
        }
    }

    @Test
    fun `MAP-01 rings are strictly ordered - closer intimacy sits closer to moi`() {
        assertTrue(MapGeometry.ringRadius(1) < MapGeometry.ringRadius(2))
        assertTrue(MapGeometry.ringRadius(2) < MapGeometry.ringRadius(3))
        assertTrue(MapGeometry.ringRadius(3) < MapGeometry.ringRadius(4))
    }

    @Test
    fun `clamp bounds a value into lo,hi`() {
        assertEquals(5f, MapGeometry.clamp(5f, 0f, 10f))
        assertEquals(0f, MapGeometry.clamp(-3f, 0f, 10f))
        assertEquals(10f, MapGeometry.clamp(42f, 0f, 10f))
    }

    @Test
    fun `MAP-07 panBound grows with zoom and is zero at rest scale`() {
        assertEquals(0f, MapGeometry.panBound(1f))
        assertTrue(MapGeometry.panBound(2f) > 0f)
        assertTrue(MapGeometry.panBound(3f) > MapGeometry.panBound(2f))
    }

    @Test
    fun `a pan clamped by panBound never reveals space beyond the scaled map`() {
        val scale = 2.5f
        val bound = MapGeometry.panBound(scale)
        assertEquals(bound, MapGeometry.clamp(9999f, -bound, bound))
        assertEquals(-bound, MapGeometry.clamp(-9999f, -bound, bound))
        assertTrue(bound <= ((scale - 1f) * MapGeometry.MAP_SIZE) / 2f + 1e-4f)
    }

    @Test
    fun `nodeSize steps down per ring - closer reads bigger`() {
        assertEquals(44f, MapGeometry.nodeSize(1))
        assertEquals(40f, MapGeometry.nodeSize(2))
        assertEquals(36f, MapGeometry.nodeSize(3))
        assertEquals(32f, MapGeometry.nodeSize(4))
    }

    @Test
    fun `positionOn(1,0) matches the RN reference's first-slot placement`() {
        // angle = 0 * 2.399963 = 0 -> cos=1, sin=0
        val r = MapGeometry.ringRadius(1)
        val expectedLeft = MapGeometry.MAP_SIZE / 2f + r - MapGeometry.NODE_HALF_WIDTH
        val expectedTop = MapGeometry.MAP_SIZE / 2f - MapGeometry.NODE_HALF_HEIGHT
        val pos = MapGeometry.positionOn(1, 0)
        assertEquals(expectedLeft, pos.left, 1e-3f)
        assertEquals(expectedTop, pos.top, 1e-3f)
    }
}
