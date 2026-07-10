package com.swab.android.fiche

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * FS-03 privacy invariant (G1 / acceptance criterion: "inspecting network
 * traffic shows only POST /vault") — enforced structurally, mirroring
 * carte/CarteOfflineStructuralTest (MAP-05): nothing under the fiche or
 * ui/fiche source trees may import the network layer or an HTTP primitive.
 * Any vault sync that happens is triggered elsewhere (VaultSync, VLT-04),
 * never from this feature directly.
 */
class FicheOfflineStructuralTest {

    private val offlineDirs = listOf(
        "app/src/main/kotlin/com/swab/android/fiche",
        "app/src/main/kotlin/com/swab/android/ui/fiche",
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
    fun `found the fiche and ui-fiche sources to scan`() {
        val root = repoRoot()
        val files = offlineDirs.flatMap { kotlinFiles(File(root, it)) }
        assertTrue("expected at least 3 source files, found ${files.size}", files.size >= 3)
    }

    @Test
    fun `FCH-01 no fiche source imports the network layer or an HTTP primitive`() {
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
