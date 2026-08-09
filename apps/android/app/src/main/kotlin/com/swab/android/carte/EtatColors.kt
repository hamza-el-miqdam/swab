package com.swab.android.carte

import com.swab.android.l10n.Fr
import com.swab.android.ui.theme.DesignTokens

/**
 * MAP-03 — état → node color. Blueprint palette mapped onto the SHIPPED
 * état vocabulary (disponible / occupé / ailleurs / en pause). The
 * blueprint's richer 5-état taxonomy is a separate KNOWN, FLAGGED
 * divergence (rn-native-handoff.md §5, carried over verbatim from
 * apps/mobile/src/map/etatColors.ts) — do not silently expand it further;
 * resolution beyond `en pause` is a product decision.
 *
 * `en pause` (#A69CB0) is a new addition (OQ-FCH-2, resolved 2026-08-09,
 * issue #16 — moved here from Ressenti, which never had its own color
 * mapping). Not blueprint-sourced like the other 3; chosen as a muted,
 * desaturated dusty-lavender to read as "neutral/inactive" while matching
 * the existing palette's low-saturation, mid-lightness style.
 *
 * No Android/Compose imports: colors are hex strings, kept platform-free so
 * this stays plain-JVM-testable. The UI layer parses them and substitutes
 * its own neutral surface/line color when [etatColor] returns nulls (an
 * unset état, or an état outside the 4 known values).
 */
object EtatColors {
    val ETAT_COLORS: Map<String, String> = mapOf(
        // SUG-DES-006: values now sourced from the token SSOT (tokens.json →
        // DesignTokens.kt, generated). Tokens are stored lowercase; uppercased
        // here so the hex strings — and EtatColorsTest — stay byte-identical
        // to the pre-indirection literals. Pure indirection, no value change.
        Fr.ETAT_AVAILABLE to DesignTokens.Color.ETAT_DISPONIBLE.uppercase(),
        Fr.ETAT_BUSY to DesignTokens.Color.ETAT_OCCUPE.uppercase(),
        Fr.ETAT_AWAY to DesignTokens.Color.ETAT_AILLEURS.uppercase(),
        Fr.ETAT_PAUSED to "#A69CB0",
    )

    // SUG-AND-009: ivory node-initials text (~2:1 contrast) on these mid-light
    // pastels fails WCAG AA (needs >=4.5:1). Reuses the theme's existing
    // "dark ink on light accent" precedent (ETOILE_ENCRE, DesignTokens.kt:22
    // — used as onPrimary over the light étoile gold) rather than inventing a
    // new value; hardcoded here (not imported) to keep this object
    // Android/Compose-import-free, per its stated contract. Yields >=7:1 on
    // all three known état pastels — design-agent territory to ratify
    // (packages/ui tokens SSOT), flagged as such rather than treated final.
    private const val DARK_INK = "#1c1505"

    /** background/border/onBackground are null when the caller should fall back to the neutral theme color. */
    data class EtatColor(val background: String?, val border: String?, val onBackground: String?)

    fun etatColor(etat: String?): EtatColor {
        val background = etat?.let { ETAT_COLORS[it] }
        val onBackground = background?.let { DARK_INK }
        return EtatColor(background = background, border = background, onBackground = onBackground)
    }
}
