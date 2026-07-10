package com.swab.android.ui.nav

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MAP-02 — the persistent nav is label-only: no badge, counter, or dot can
 * be rendered there by construction. Enforced structurally: BottomNav.kt
 * must never reference a Badge/count API (mirrors the RN reference's
 * nav-bar.tsx doc comment, made testable since Kotlin has no equivalent to
 * jest-scanning the rendered tree for a Badge composable without
 * instrumentation).
 */
class BottomNavStructuralTest {

    private fun repoRoot(): File {
        var dir = File(".").absoluteFile
        while (!File(dir, "settings.gradle.kts").exists()) {
            dir = dir.parentFile ?: error("settings.gradle.kts not found above $dir")
        }
        return dir
    }

    @Test
    fun `MAP-02 BottomNav source never references a badge or counter API`() {
        val file = File(repoRoot(), "app/src/main/kotlin/com/swab/android/ui/nav/BottomNav.kt")
        assertTrue("expected BottomNav.kt to exist at ${file.path}", file.exists())
        val source = file.readText()
        for (pattern in listOf(Regex("(?i)badge"), Regex("(?i)unread"), Regex("\\bcount\\b"))) {
            assertFalse("BottomNav.kt matches forbidden pattern $pattern", pattern.containsMatchIn(source))
        }
    }

    @Test
    fun `MAP-02 exactly three destinations are declared`() {
        assertTrue(MainDestination.entries.size == 3)
    }
}
