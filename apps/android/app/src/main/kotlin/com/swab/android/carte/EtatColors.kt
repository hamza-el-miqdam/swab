package com.swab.android.carte

import com.swab.android.l10n.Fr

/**
 * MAP-03 — état → node color. Blueprint palette mapped onto the SHIPPED
 * 3-état vocabulary (disponible / occupé / ailleurs). The blueprint's richer
 * 5-état taxonomy is a KNOWN, FLAGGED divergence (rn-native-handoff.md §5,
 * carried over verbatim from apps/mobile/src/map/etatColors.ts) — do not
 * silently expand it; resolution is a product decision.
 *
 * No Android/Compose imports: colors are hex strings, kept platform-free so
 * this stays plain-JVM-testable. The UI layer parses them and substitutes
 * its own neutral surface/line color when [etatColor] returns nulls (an
 * unset état, or an état outside the 3 known values).
 */
object EtatColors {
    val ETAT_COLORS: Map<String, String> = mapOf(
        Fr.ETAT_AVAILABLE to "#8FB59A",
        Fr.ETAT_BUSY to "#C8917E",
        Fr.ETAT_AWAY to "#8AA0BE",
    )

    /** background/border are null when the caller should fall back to the neutral theme color. */
    data class EtatColor(val background: String?, val border: String?)

    fun etatColor(etat: String?): EtatColor {
        val background = etat?.let { ETAT_COLORS[it] }
        return EtatColor(background = background, border = background)
    }
}
