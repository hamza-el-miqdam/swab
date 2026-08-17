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
 *
 * FCH-09: the comparison is against the stored identifier [Etat.PAUSED], not
 * against `Fr.ETAT_PAUSED`. The old string compare meant a copy edit silently
 * stopped showing the consequence — a filtering rule going quiet, which
 * « rien ne disparaît en silence » forbids.
 */
object FicheFilterConsequence {
    fun forValue(value: Etat?): String? = when (value) {
        Etat.PAUSED -> Fr.FICHE_ETAT_PAUSED_CONSEQUENCE
        else -> null
    }
}
