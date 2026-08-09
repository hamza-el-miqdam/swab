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
        assertEquals(Fr.FICHE_ETAT_PAUSED_CONSEQUENCE, FicheFilterConsequence.forValue(Fr.ETAT_PAUSED))
    }

    @Test
    fun `FCH-06 other values show no consequence text`() {
        assertNull(FicheFilterConsequence.forValue(Fr.ETAT_AVAILABLE))
        assertNull(FicheFilterConsequence.forValue(Fr.ETAT_BUSY))
        assertNull(FicheFilterConsequence.forValue(Fr.ETAT_AWAY))
        assertNull(FicheFilterConsequence.forValue(Fr.RESSENTI_LIGHT))
        assertNull(FicheFilterConsequence.forValue(Fr.RESSENTI_PRECIOUS))
    }

    @Test
    fun `FCH-06 null value shows no consequence text`() {
        assertNull(FicheFilterConsequence.forValue(null))
    }
}
