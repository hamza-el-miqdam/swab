package com.swab.android.sync

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * VLT-04 — the three triggers live in Android lifecycle / DI code that no JVM
 * unit test can instantiate (`MainActivity` and `AppContainer` are excluded
 * from the domain-coverage report for exactly that reason). [SyncSchedulerTest]
 * proves the scheduler behaves; this proves it is actually plugged in, so the
 * wiring cannot be deleted silently the way the missing triggers went
 * unnoticed until SUG-AND-001.
 *
 * Same structural-guard technique as `CarteOfflineStructuralTest` /
 * `FicheOfflineStructuralTest`.
 */
class SyncTriggerWiringStructuralTest {

    private fun repoRoot(): File {
        var dir = File(".").absoluteFile
        while (!File(dir, "settings.gradle.kts").exists()) {
            dir = dir.parentFile ?: error("settings.gradle.kts not found above $dir")
        }
        return dir
    }

    private fun source(path: String): String {
        val file = File(repoRoot(), path)
        assertTrue("expected to find $path", file.isFile)
        return file.readText()
    }

    private fun mainSources(): List<File> =
        File(repoRoot(), "app/src/main/kotlin").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    @Test
    fun test_VLT04_mainActivityFiresTheBackgroundAndForegroundTriggers() {
        val mainActivity = source("app/src/main/kotlin/com/swab/android/MainActivity.kt")

        assertTrue(
            "MainActivity must call the scheduler's background trigger from onStop (VLT-04 \"app background\")",
            Regex("""override\s+fun\s+onStop\(\)[\s\S]{0,400}?syncScheduler\??\.onAppBackground\(\)""").containsMatchIn(mainActivity),
        )
        assertTrue(
            "MainActivity must retry queued work from onStart (the reconnect proxy)",
            Regex("""override\s+fun\s+onStart\(\)[\s\S]{0,400}?syncScheduler\??\.onAppForeground\(\)""").containsMatchIn(mainActivity),
        )
    }

    @Test
    fun test_VLT04_appContainerNotifiesTheSchedulerOnEveryVaultWrite() {
        val container = source("app/src/main/kotlin/com/swab/android/AppContainer.kt")

        assertTrue(
            "AppContainer must pass the write callback into Vault (VLT-04 \"after any vault write burst\")",
            Regex("""onPersist\s*=\s*\{[^}]*syncScheduler\.onWrite\(\)""").containsMatchIn(container),
        )
        assertTrue(
            "the scheduler must be gated on onboarding being complete (ONB-05)",
            container.contains("OnboardingStep.COMPLETE"),
        )
    }

    @Test
    fun test_VLT04_everySyncGoesThroughTheScheduler() {
        val offenders = mainSources().filter { file ->
            file.name != "VaultSync.kt" && Regex("""\.syncVault\(""").containsMatchIn(file.readText())
        }
        assertTrue(
            "sync must be triggered through SyncScheduler, never called directly: $offenders",
            offenders.isEmpty(),
        )
    }

    @Test
    fun test_VLT10_exactlyOneAppContainerIsEverConstructed_andNotByTheActivity() {
        // Review finding F3. A container per `MainActivity.onCreate` meant a
        // rotation left the surviving ViewModels (whose `viewModel { }`
        // initializers do not re-run — SUG-AND-003) writing to a dead vault
        // and scheduler while the lifecycle triggers drove a fresh, always
        // empty one. Behaviour is pinned on-device by
        // `SyncAcrossRecreationE2ETest`; this is the cheap guard that stops
        // the wiring drifting back.
        val constructors = mainSources().filter { file ->
            Regex("""(?<!class )\bAppContainer\(""").containsMatchIn(file.readText())
        }.map { it.name }.sorted()

        assertEquals(
            "AppContainer must be constructed exactly once, by SwabApplication: found $constructors",
            listOf("SwabApplication.kt"),
            constructors,
        )
    }

    @Test
    fun test_VLT04_theVaultItselfStaysFreeOfSchedulerAndNetworkImports() {
        val vault = source("app/src/main/kotlin/com/swab/android/vault/Vault.kt")

        // The callback seam is the whole point: the vault notifies "something
        // changed" and knows nothing about who listens.
        assertFalse(vault.contains("import com.swab.android.sync"))
        assertFalse(vault.contains("import com.swab.android.network"))
    }
}
