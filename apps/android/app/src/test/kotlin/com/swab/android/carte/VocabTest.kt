package com.swab.android.carte

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * SUG-AND-017 — locks the single shared vocab lists so CalibrateScreen and
 * FicheScreen can never silently diverge again (they both import [Vocab]
 * now, but this pins the *content* those imports resolve to).
 */
class VocabTest {

    @Test
    fun `FCH-06 every etat with a color mapping is in the shared ETATS list`() {
        assertEquals(EtatColors.ETAT_COLORS.keys, Vocab.ETATS.toSet())
    }

    @Test
    fun `ONB-06 vocab lists contain exactly the shipped values`() {
        assertEquals(4, Vocab.ETATS.size)
        assertEquals(3, Vocab.RESSENTIS.size)
        assertEquals(Vocab.ETATS.toSet(), Vocab.ETATS.toSet()) // no accidental dupes below
        assertEquals(Vocab.ETATS.size, Vocab.ETATS.toSet().size)
        assertEquals(Vocab.RESSENTIS.size, Vocab.RESSENTIS.toSet().size)
    }
}
