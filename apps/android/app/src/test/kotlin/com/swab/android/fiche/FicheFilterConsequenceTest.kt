package com.swab.android.fiche

import com.swab.android.l10n.Fr
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * FS-03 FCH-06 — "en pause" surfaces the FS-06 filter consequence text.
 * OQ-FCH-2 resolved 2026-08-09 (issue #16): état is canonical, so these
 * assertions lock the NEW axis assignment (état, not ressenti).
 */
class FicheFilterConsequenceTest {

    @Test
    fun `FCH-06 en pause shows the exclusion consequence text`() {
        assertEquals(Fr.FICHE_ETAT_PAUSED_CONSEQUENCE, FicheFilterConsequence.forValue(Etat.PAUSED))
    }

    @Test
    fun `FCH-06 other etat values show no consequence text`() {
        assertNull(FicheFilterConsequence.forValue(Etat.AVAILABLE))
        assertNull(FicheFilterConsequence.forValue(Etat.BUSY))
        assertNull(FicheFilterConsequence.forValue(Etat.AWAY))
    }

    /**
     * FCH-09 regression: the consequence used to be `value == Fr.ETAT_PAUSED`,
     * so a copy edit silently stopped surfacing it — a filter going quiet,
     * which « rien ne disparaît en silence » forbids. Keyed on the identifier,
     * the text survives any copy change.
     */
    @Test
    fun `FCH-09 consequence keys on the identifier not display copy`() {
        assertEquals("paused", Etat.PAUSED.id)
        assertEquals(Fr.FICHE_ETAT_PAUSED_CONSEQUENCE, FicheFilterConsequence.forValue(Etat.parse("paused")))
        // A ressenti value can no longer even be passed here — the axis
        // confusion OQ-FCH-2 resolved is now unrepresentable in the type.
    }

    @Test
    fun `FCH-06 null value shows no consequence text`() {
        assertNull(FicheFilterConsequence.forValue(null))
    }
}
