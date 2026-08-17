package com.swab.android.carte

import com.swab.android.fiche.Etat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MAP-03 — état → node color, restricted to the SHIPPED état vocabulary
 * (now 4 values since OQ-FCH-2 moved `en pause` here, resolved 2026-08-09,
 * issue #16). The blueprint's richer 5-état taxonomy remains a separate
 * flagged divergence (see the doc comment on EtatColors) — this test locks
 * the 4 shipped values and the neutral fallback so nobody silently expands
 * the map further.
 */
class EtatColorsTest {

    @Test
    fun `exactly the 4 shipped etats are mapped`() {
        assertEquals(
            setOf(Etat.AVAILABLE, Etat.BUSY, Etat.AWAY, Etat.PAUSED),
            EtatColors.ETAT_COLORS.keys,
        )
    }

    @Test
    fun `known etats resolve to their blueprint hex colors`() {
        assertEquals("#8FB59A", EtatColors.etatColor(Etat.AVAILABLE).background)
        assertEquals("#C8917E", EtatColors.etatColor(Etat.BUSY).background)
        assertEquals("#8AA0BE", EtatColors.etatColor(Etat.AWAY).background)
    }

    @Test
    fun `en pause resolves to its new dedicated color`() {
        assertEquals("#A69CB0", EtatColors.etatColor(Etat.PAUSED).background)
    }

    @Test
    fun `background and border are the same color for a known etat`() {
        val color = EtatColors.etatColor(Etat.AVAILABLE)
        assertEquals(color.background, color.border)
    }

    @Test
    fun `unset etat falls back to a null background - UI substitutes the neutral theme color`() {
        assertNull(EtatColors.etatColor(null).background)
        assertNull(EtatColors.etatColor(null).border)
    }

    /**
     * FCH-09 moved the "unknown état" case one layer up: a token outside the
     * vocabulary no longer reaches this lookup — it parses to null and takes
     * the same neutral path as an unset état.
     */
    @Test
    fun `an etat outside the 4 known values also falls back to null - no silent 5-etat expansion`() {
        assertNull(Etat.parse("radieux"))
        assertNull(EtatColors.etatColor(Etat.parse("radieux")).background)
    }

    @Test
    fun `MAP-03 each known etat provides a dark onBackground color`() {
        val expected = "#1c1505"
        assertEquals(expected, EtatColors.etatColor(Etat.AVAILABLE).onBackground)
        assertEquals(expected, EtatColors.etatColor(Etat.BUSY).onBackground)
        assertEquals(expected, EtatColors.etatColor(Etat.AWAY).onBackground)
        assertEquals(expected, EtatColors.etatColor(Etat.PAUSED).onBackground)
    }

    @Test
    fun `MAP-03 unknown or null etat has null onBackground - falls back to theme`() {
        assertNull(EtatColors.etatColor(null).onBackground)
        assertNull(EtatColors.etatColor(Etat.parse("radieux")).onBackground)
    }

    @Test
    fun `MAP-03 onBackground meets 4,5-1 contrast on its background`() {
        for (etat in EtatColors.ETAT_COLORS.keys) {
            val palette = EtatColors.etatColor(etat)
            val ratio = contrastRatio(palette.background!!, palette.onBackground!!)
            assertTrue("$etat: contrast $ratio must be >= 4.5", ratio >= 4.5)
        }
    }

    /** WCAG 2.x relative-luminance contrast ratio, pure Kotlin — no Android/graphics deps. */
    private fun contrastRatio(hexA: String, hexB: String): Double {
        val lumA = relativeLuminance(hexA)
        val lumB = relativeLuminance(hexB)
        val lighter = maxOf(lumA, lumB)
        val darker = minOf(lumA, lumB)
        return (lighter + 0.05) / (darker + 0.05)
    }

    private fun relativeLuminance(hex: String): Double {
        val clean = hex.removePrefix("#")
        val r = clean.substring(0, 2).toInt(16) / 255.0
        val g = clean.substring(2, 4).toInt(16) / 255.0
        val b = clean.substring(4, 6).toInt(16) / 255.0
        fun channel(c: Double) = if (c <= 0.03928) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
}
