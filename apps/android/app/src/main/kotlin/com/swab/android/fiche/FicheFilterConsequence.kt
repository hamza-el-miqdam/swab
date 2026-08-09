package com.swab.android.fiche

import com.swab.android.l10n.Fr

/**
 * FS-03 FCH-06 — "État → filter consequence" legibility text. Purely
 * informational: FS-06 (the actual filtering engine) isn't built yet, so this
 * never influences real recipient resolution, it only tells the user what
 * would happen once it does.
 *
 * OQ-FCH-2 RESOLVED (2026-08-09, issue #16): `en pause` is canonically an
 * ÉTAT value — the état-vs-ressenti dual-axis workaround this object used to
 * carry is gone. [forValue] checks état only.
 */
object FicheFilterConsequence {
    fun forValue(value: String?): String? = when (value) {
        Fr.ETAT_PAUSED -> Fr.FICHE_ETAT_PAUSED_CONSEQUENCE
        else -> null
    }
}
