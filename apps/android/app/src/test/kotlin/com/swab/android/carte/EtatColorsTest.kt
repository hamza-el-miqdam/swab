package com.swab.android.carte

import com.swab.android.l10n.Fr
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * MAP-03 — état → node color, restricted to the SHIPPED 3-état vocabulary.
 * The blueprint's richer 5-état taxonomy is a flagged divergence (see the
 * doc comment on EtatColors) — this test locks the 3 shipped values and the
 * neutral fallback so nobody silently expands the map.
 */
class EtatColorsTest {

    @Test
    fun `exactly the 3 shipped etats are mapped`() {
        assertEquals(setOf(Fr.ETAT_AVAILABLE, Fr.ETAT_BUSY, Fr.ETAT_AWAY), EtatColors.ETAT_COLORS.keys)
    }

    @Test
    fun `known etats resolve to their blueprint hex colors`() {
        assertEquals("#8FB59A", EtatColors.etatColor(Fr.ETAT_AVAILABLE).background)
        assertEquals("#C8917E", EtatColors.etatColor(Fr.ETAT_BUSY).background)
        assertEquals("#8AA0BE", EtatColors.etatColor(Fr.ETAT_AWAY).background)
    }

    @Test
    fun `background and border are the same color for a known etat`() {
        val color = EtatColors.etatColor(Fr.ETAT_AVAILABLE)
        assertEquals(color.background, color.border)
    }

    @Test
    fun `unset etat falls back to a null background - UI substitutes the neutral theme color`() {
        assertNull(EtatColors.etatColor(null).background)
        assertNull(EtatColors.etatColor(null).border)
    }

    @Test
    fun `an etat outside the 3 known values also falls back to null - no silent 5-etat expansion`() {
        assertNull(EtatColors.etatColor("radieux").background)
    }
}
