package com.swab.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * `androidx.compose.material3.Shapes` built from `DesignTokens.Radius` —
 * SUG-DES-004. small=INPUT(10), medium=CARD(12), large=TILE(14); the
 * remaining M3 slots (extraSmall/extraLarge) stay at M3 defaults — no
 * charter-defined radius maps to them.
 */
val SwabShapes = Shapes(
    small = RoundedCornerShape(DesignTokens.Radius.INPUT.dp),
    medium = RoundedCornerShape(DesignTokens.Radius.CARD.dp),
    large = RoundedCornerShape(DesignTokens.Radius.TILE.dp),
)
