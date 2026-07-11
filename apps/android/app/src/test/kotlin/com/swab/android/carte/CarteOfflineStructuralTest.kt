package com.swab.android.carte

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MAP-05 — the map renders fully offline from the vault. Enforced
 * structurally, mirroring apps/mobile's
 * src/__tests__/carte-offline.map05.test.ts: nothing under the carte or
 * ui/carte source trees may import the network layer or an HTTP primitive.
 */
class CarteOfflineStructuralTest {

    private val offlineDirs = listOf(
        "app/src/main/kotlin/com/swab/android/carte",
        "app/src/main/kotlin/com/swab/android/ui/carte",
    )

    private val forbidden = listOf(
        Regex("""import\s+com\.swab\.android\.network"""),
        Regex("""\bApiClient\b"""),
        Regex("""\bHttpTransport\b"""),
        Regex("""\bHttpURLConnection\b"""),
        Regex("""\bOkHttp"""),
    )

    private fun repoRoot(): File {
        var dir = File(".").absoluteFile
        while (!File(dir, "settings.gradle.kts").exists()) {
            dir = dir.parentFile ?: error("settings.gradle.kts not found above $dir")
        }
        return dir
    }

    private fun kotlinFiles(dir: File): List<File> =
        dir.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    @Test
    fun `found the carte and ui-carte sources to scan`() {
        val root = repoRoot()
        val files = offlineDirs.flatMap { kotlinFiles(File(root, it)) }
        assertTrue("expected at least 5 source files, found ${files.size}", files.size >= 5)
    }

    @Test
    fun `MAP-05 no carte source imports the network layer or an HTTP primitive`() {
        val root = repoRoot()
        val files = offlineDirs.flatMap { kotlinFiles(File(root, it)) }
        for (file in files) {
            val source = file.readText()
            for (pattern in forbidden) {
                assertFalse(
                    "${file.path} matches forbidden offline pattern $pattern",
                    pattern.containsMatchIn(source),
                )
            }
        }
    }
}
