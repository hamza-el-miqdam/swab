package com.swab.android.l10n

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * MAP-09 / product law 5 — discovery is spatial only: no global search, no
 * sorting metrics, no "top friends". Mirrors
 * apps/mobile/src/__tests__/carte-ethos.map09.test.tsx's copy-vocabulary
 * assertion. MAP-02 — the nav exposes exactly 3 destinations.
 */
class CarteEthosCopyTest {

    private val carteAndNavCopy = listOf(
        Fr.CARTE_TITLE, Fr.CARTE_SUBTITLE, Fr.CARTE_EMPTY, Fr.CARTE_ME, Fr.CARTE_LIST_MODE,
        Fr.CARTE_LEGEND, Fr.CARTE_OPEN_FICHE, Fr.CARTE_SHEET_INTIMITE, Fr.CARTE_SHEET_ETAT,
        Fr.CARTE_SHEET_ROLES, Fr.NAV_CARTE, Fr.NAV_ENVIE, Fr.NAV_SOUS_GROUPES,
    ).joinToString(" ")

    @Test
    fun `MAP-09 carte and nav copy carries no ranking or metric vocabulary`() {
        val forbidden = Regex("(?i)\\btop\\b|classement|meilleur|score|tri(er)?\\b")
        assertFalse(forbidden.containsMatchIn(carteAndNavCopy))
    }

    @Test
    fun `MAP-09 carte and nav copy never mentions search`() {
        assertFalse(Regex("(?i)recherche").containsMatchIn(carteAndNavCopy))
    }

    @Test
    fun `MAP-02 exactly three primary nav destinations - Carte, Envie, Sous-groupes`() {
        assertEquals("Carte", Fr.NAV_CARTE)
        assertEquals("Envie", Fr.NAV_ENVIE)
        assertEquals("Sous-groupes", Fr.NAV_SOUS_GROUPES)
    }
}
