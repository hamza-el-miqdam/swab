package com.swab.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Minimal Material 3 scheme placeholder — the Swab graphic charter ("Nuit")
// design tokens land with the design specialist's work; this is the
// functional seam so Wave-1 screens have a working theme.
private val SwabDark = darkColorScheme(
    primary = Color(0xFFE5E7EB),
    background = Color(0xFF0B1120),
    surface = Color(0xFF111827),
)

private val SwabLight = lightColorScheme(
    primary = Color(0xFF111827),
    background = Color(0xFFFFFFFF),
    surface = Color(0xFFF3F4F6),
)

@Composable
fun SwabTheme(content: @Composable () -> Unit) {
    val colorScheme = if (isSystemInDarkTheme()) SwabDark else SwabLight
    MaterialTheme(colorScheme = colorScheme, content = content)
}
