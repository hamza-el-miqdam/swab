package com.swab.android.ui.theme

import androidx.compose.foundation.shape.CornerSize
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

/** SUG-DES-004 — `SwabShapes` locked to `DesignTokens.Radius`. */
class SwabShapesTest {

    private val density = Density(density = 1f)

    private fun cornerSizePx(size: CornerSize) = size.toPx(androidx.compose.ui.geometry.Size.Zero, density)

    @Test
    fun `small shape uses the INPUT radius`() {
        assertEquals(DesignTokens.Radius.INPUT.dp.value * density.density, cornerSizePx(SwabShapes.small.topStart), 0.01f)
    }

    @Test
    fun `medium shape uses the CARD radius`() {
        assertEquals(DesignTokens.Radius.CARD.dp.value * density.density, cornerSizePx(SwabShapes.medium.topStart), 0.01f)
    }

    @Test
    fun `large shape uses the TILE radius`() {
        assertEquals(DesignTokens.Radius.TILE.dp.value * density.density, cornerSizePx(SwabShapes.large.topStart), 0.01f)
    }
}
