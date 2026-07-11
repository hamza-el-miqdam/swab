package com.swab.android.ui.carte

import androidx.compose.ui.graphics.Color

/** `#RRGGBB` (as produced by [com.swab.android.carte.EtatColors]) → Compose [Color]. */
internal fun hexToColor(hex: String): Color {
    val clean = hex.removePrefix("#")
    return Color(0xFF000000 or clean.toLong(16))
}
