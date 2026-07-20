package com.swab.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Nuit is the Swab graphic charter's ONE theme — docs/design-system.md §1 ("The
// palette is a single dark theme called Nuit") — there is no light palette in
// the charter, Penpot tokens, or tokens.json. We therefore build a single
// darkColorScheme from DesignTokens and never branch on isSystemInDarkTheme();
// the app always renders Nuit regardless of the OS light/dark setting. This
// replaces the previous placeholder, which branched between a real SwabDark
// and an invented SwabLight — see apps/android/CHANGELOG.md 2026-07-19 entry.

/** `#RRGGBB` token → opaque Compose [Color]. */
private fun tokenColor(hex: String): Color {
    val clean = hex.removePrefix("#")
    return Color(0xFF000000 or clean.toLong(16))
}

/** `#RRGGBB` token + separate opacity (as stored for `hair`/`hair-fort`) → Compose [Color]. */
private fun tokenColor(hex: String, opacity: Double): Color {
    val clean = hex.removePrefix("#")
    val rgb = clean.toLong(16) and 0xFFFFFF
    val alpha = (opacity.coerceIn(0.0, 1.0) * 255).toInt().toLong()
    return Color((alpha shl 24) or rgb)
}

// Role mapping — docs/design-system.md §1 role descriptions, not Material3's
// default naming guesses. Only roles with a clear Nuit equivalent are set;
// roles with no charter basis (tertiary*, error*, secondary*, inverse*,
// scrim, and the finer surfaceDim/Bright/surfaceContainer* tonal steps beyond
// voile-2) are left at Material3's built-in defaults rather than invented —
// see the CHANGELOG entry for the full list of what was deliberately left
// unset and why.
private val SwabNuit = darkColorScheme(
    background = tokenColor(DesignTokens.Color.NUIT),
    onBackground = tokenColor(DesignTokens.Color.IVOIRE),
    surface = tokenColor(DesignTokens.Color.ENCRE),
    onSurface = tokenColor(DesignTokens.Color.IVOIRE),
    surfaceVariant = tokenColor(DesignTokens.Color.VOILE),
    onSurfaceVariant = tokenColor(DesignTokens.Color.BRUME),
    surfaceContainerHighest = tokenColor(DesignTokens.Color.VOILE_2),
    outline = tokenColor(DesignTokens.Color.HAIR_FORT, DesignTokens.Color.HAIR_FORT_OPACITY),
    outlineVariant = tokenColor(DesignTokens.Color.HAIR, DesignTokens.Color.HAIR_OPACITY),
    primary = tokenColor(DesignTokens.Color.ETOILE),
    onPrimary = tokenColor(DesignTokens.Color.ETOILE_ENCRE),
)

@Composable
fun SwabTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = SwabNuit, content = content)
}
