package com.swab.android.ui.theme

import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * SUG-DES-004 — locks `SwabTypography` (built in Typography.kt) to the
 * `DesignTokens.Typography` SSOT it's generated from. Plain-JVM testable:
 * constructing `androidx.compose.ui.text.TextStyle`/`FontFamily`/`Font`
 * values needs no Android runtime or emulator (same convention as
 * DesignTokens.kt / EtatColors.kt).
 */
class SwabTypographyTest {

    @Test
    fun `bodyLarge fontSize matches the BASE token`() {
        assertEquals(DesignTokens.Typography.BASE.size.sp, SwabTypography.bodyLarge.fontSize)
    }

    @Test
    fun `titleLarge fontSize matches the TITLE token`() {
        assertEquals(DesignTokens.Typography.TITLE.size.sp, SwabTypography.titleLarge.fontSize)
    }

    @Test
    fun `labelLarge fontSize matches the BUTTON token`() {
        assertEquals(DesignTokens.Typography.BUTTON.size.sp, SwabTypography.labelLarge.fontSize)
    }

    @Test
    fun `bodyMedium fontSize matches the SUBTITLE token`() {
        assertEquals(DesignTokens.Typography.SUBTITLE.size.sp, SwabTypography.bodyMedium.fontSize)
    }

    @Test
    fun `labelSmall fontSize matches the LABEL token`() {
        assertEquals(DesignTokens.Typography.LABEL.size.sp, SwabTypography.labelSmall.fontSize)
    }

    @Test
    fun `labelSmall letterSpacing is em-relative per the token, not a fixed sp value`() {
        // letterSpacingEm is unitless (em), converted via the .em extension —
        // NOT `.sp`, which would break Dynamic-Type scaling (SUG-DES-012).
        assertEquals(
            DesignTokens.Typography.LABEL.letterSpacingEm.toFloat(),
            SwabTypography.labelSmall.letterSpacing.value,
            0.0001f,
        )
    }

    @Test
    fun `lineHeight is size times the unitless multiplier, converted to sp`() {
        val expected = (DesignTokens.Typography.BASE.size * DesignTokens.Typography.BASE.lineHeight).sp
        assertEquals(expected, SwabTypography.bodyLarge.lineHeight)
    }
}
