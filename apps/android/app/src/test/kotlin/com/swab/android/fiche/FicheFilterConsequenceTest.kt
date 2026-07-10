package com.swab.android.fiche

import com.swab.android.l10n.Fr
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** FS-03 FCH-06 — "en pause" surfaces the FS-06 filter consequence text. */
class FicheFilterConsequenceTest {

    @Test
    fun `FCH-06 en pause shows the exclusion consequence text`() {
        assertEquals(Fr.FICHE_ETAT_PAUSED_CONSEQUENCE, FicheFilterConsequence.forValue(Fr.RESSENTI_PAUSED))
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
