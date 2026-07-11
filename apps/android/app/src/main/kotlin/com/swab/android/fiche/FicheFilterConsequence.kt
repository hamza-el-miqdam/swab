package com.swab.android.fiche

import com.swab.android.l10n.Fr

/**
 * FS-03 FCH-06 — "État → filter consequence" legibility text. Purely
 * informational: FS-06 (the actual filtering engine) isn't built yet, so this
 * never influences real recipient resolution, it only tells the user what
 * would happen once it does.
 *
 * ⚠️ ASSUMPTION / KNOWN DIVERGENCE: this task's brief instructs reusing the
 * shipped ÉTAT vocabulary (disponible/occupé/ailleurs, CalibrateScreen.kt's
 * ETATS) unchanged, but FCH-06 requires the blueprint-attested `en pause`
 * value specifically. Today `en pause` ships under RESSENTI, not ÉTAT
 * (EtatColors.kt's already-flagged divergence, rn-native-handoff.md §5) — a
 * pre-existing product decision this task does not resolve. [forValue] is
 * therefore checked against BOTH axes' current values on the fiche screen, so
 * the FCH-06 consequence text surfaces wherever "en pause" actually lives
 * today, without inventing a new état option this task wasn't asked to add.
 */
object FicheFilterConsequence {
    fun forValue(value: String?): String? = when (value) {
        Fr.RESSENTI_PAUSED -> Fr.FICHE_ETAT_PAUSED_CONSEQUENCE
        else -> null
    }
}
