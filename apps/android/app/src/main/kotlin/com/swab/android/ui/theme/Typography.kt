package com.swab.android.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.swab.android.R

// SUG-DES-004 — Inter (400/500/600) and Space Grotesk (400/500/600),
// bundled as res/font/ TTF resources (OFL 1.1, google/fonts mirror; license
// text + attribution: app/src/main/assets/font-licenses/). No network font
// fetches at runtime — the charter rule this satisfies.
private val InterFontFamily = FontFamily(
    Font(R.font.inter_regular, FontWeight.W400),
    Font(R.font.inter_medium, FontWeight.W500),
    Font(R.font.inter_semibold, FontWeight.W600),
)

private val SpaceGroteskFontFamily = FontFamily(
    Font(R.font.space_grotesk_regular, FontWeight.W400),
    Font(R.font.space_grotesk_medium, FontWeight.W500),
    Font(R.font.space_grotesk_semibold, FontWeight.W600),
)

/** DesignTokens only names families by their charter string ("Inter" /
 * "Space Grotesk"); this is the one place that resolves those strings to
 * the bundled [FontFamily]s. Falls back to the platform default rather than
 * crashing if the SSOT ever adds a family this app hasn't bundled yet. */
private fun fontFamilyFor(name: String): FontFamily = when (name) {
    "Inter" -> InterFontFamily
    "Space Grotesk" -> SpaceGroteskFontFamily
    else -> FontFamily.Default
}

/**
 * [DesignTokens.TypographyStyle] -> Compose [TextStyle]. `lineHeight` in the
 * token is a unitless multiplier (docs/design-system.md), converted here to
 * sp as `size * lineHeight` — the same conversion iOS applies, documented
 * once so both platforms do it identically (SUG-DES-004 risk note).
 * `textTransform` ("uppercase" on LABEL) is NOT applied here — Compose
 * TextStyle has no textTransform equivalent; uppercasing happens at call
 * sites that render LABEL-styled text.
 */
private fun textStyleFor(token: DesignTokens.TypographyStyle): TextStyle = TextStyle(
    fontFamily = fontFamilyFor(token.family),
    fontWeight = FontWeight(token.weight),
    fontSize = token.size.sp,
    lineHeight = (token.size * token.lineHeight).sp,
    letterSpacing = token.letterSpacingEm.em,
)

/**
 * `androidx.compose.material3.Typography` built from `DesignTokens.Typography`
 * — SUG-DES-004. Sizes stay in `.sp` throughout (never `.dp`/fixed px), so
 * Dynamic Type / system font-size scaling (SUG-DES-012, docs/design-system.md
 * §2) keeps working automatically.
 *
 * Mapping (only the M3 roles the charter actually assigns a style to; the
 * rest are left at M3 defaults, same "don't invent" convention as
 * Theme.kt's color-role mapping):
 * - titleLarge  <- TITLE (Space Grotesk 20/500)
 * - bodyLarge   <- BASE (Inter 15/400)
 * - labelLarge  <- BUTTON (Inter 15/500)
 * - bodyMedium  <- SUBTITLE (Inter 13.5/400)
 * - labelSmall  <- LABEL (Inter 11/400, letterSpacing 0.1em, uppercase at call sites)
 */
val SwabTypography = Typography(
    titleLarge = textStyleFor(DesignTokens.Typography.TITLE),
    bodyLarge = textStyleFor(DesignTokens.Typography.BASE),
    labelLarge = textStyleFor(DesignTokens.Typography.BUTTON),
    bodyMedium = textStyleFor(DesignTokens.Typography.SUBTITLE),
    labelSmall = textStyleFor(DesignTokens.Typography.LABEL),
)
