package com.swab.android

import android.content.Context
import android.content.Intent
import com.swab.android.storage.DataStoreKeyValueStore
import com.swab.android.vault.AndroidKeystoreVaultKeyStore
import com.swab.android.vault.VaultCrypto
import kotlinx.coroutines.runBlocking

/**
 * Test-only seed hooks for the instrumented E2E suite (`androidTest/.../e2e/`)
 * — the Android twin of iOS's `--uitesting-seed-legacy-vault` launch-argument
 * hook in apps/ios/App/SwabApp.swift.
 *
 * RELEASE SAFETY — why this is unreachable in a release build, strongest
 * guarantee first:
 *  1. This file lives in `src/debug/kotlin`. The release variant compiles
 *     `src/release/kotlin/com/swab/android/E2ESeedHooks.kt` instead — a no-op
 *     whose body is empty. The seeding code below is therefore not merely
 *     dead-code-gated: it IS NOT IN the release APK at all, byte-for-byte
 *     the same exclusion class as iOS's `#if DEBUG` (compile-time, not
 *     runtime).
 *  2. Belt-and-braces: even in a debug build the hook only fires when the
 *     launching Intent carries [EXTRA_SEED_LEGACY_VAULT] — an extra only the
 *     E2E test (`LegacyVaultCompatE2ETest`) sets. A debug build launched
 *     normally behaves identically to before this change.
 *
 * Trigger choice — Intent extra rather than an instrumentation-runner
 * argument: runner arguments (`InstrumentationRegistry.getArguments()`) are
 * only readable from instrumentation-aware code, and reading them from
 * production `src/main` code would drag a test-infra dependency into the app.
 * An Intent extra keeps `src/main`'s only touchpoint a single call into this
 * variant-selected object, and lets the test target one specific launch
 * (`ActivityScenario.launch(intent)`) instead of poisoning every test in the
 * process.
 */
object E2ESeedHooks {
    const val EXTRA_SEED_LEGACY_VAULT = "com.swab.android.e2e.SEED_LEGACY_VAULT"

    /** Stable persisted-state keys, mirroring Vault.BLOB_KEY / Vault.VERSION_KEY /
     * OnboardingStateStore.STEP_KEY (private there by design — production code
     * must go through those classes; this hook deliberately writes AROUND them
     * to plant bytes "already on disk from an older build"). Same documented
     * cross-platform names the iOS hook uses. */
    private const val BLOB_KEY = "vault.blob.v1"
    private const val VERSION_KEY = "vault.version.v1"
    private const val STEP_KEY = "onboarding.step.v1"

    /**
     * Seeds a PRE-FS-03 vault blob through the REAL crypto path: the real
     * Android-Keystore-wrapped vault key ([AndroidKeystoreVaultKeyStore], the
     * exact production `getOrCreateVaultKey()` — hardware-backed wrap key,
     * `javax.crypto` AES-256-GCM) and the real [VaultCrypto] wire format
     * (IV ‖ TAG ‖ CIPHERTEXT, base64). Nothing here is a fake or a bypass of
     * the encryption — only the JSON *shape* is deliberately old.
     */
    fun apply(intent: Intent?, context: Context) {
        if (intent?.getBooleanExtra(EXTRA_SEED_LEGACY_VAULT, false) != true) return

        // runBlocking on the main thread is acceptable in this test-only,
        // opt-in path (a few DataStore writes + one Keystore op at launch).
        runBlocking {
            val kv = DataStoreKeyValueStore(context)
            val key = AndroidKeystoreVaultKeyStore(kv).getOrCreateVaultKey()

            // Deliberately hand-written JSON in the PRE-FS-03 shape: no
            // `history` array, no `targetId` / `lastAxisChangeAt` /
            // `staleSnoozedUntil` keys — exactly what a Wave 1/2 vault looked
            // like on disk before commit 162b0c8 grew VaultData/VaultContact
            // (kept in lockstep with the iOS hook's legacyContactsJSON).
            val legacyVaultJson =
                """{"contacts":[{"id":"legacy-contact-1","displayName":"Contact Historique","phoneHash":null,"ring":1,"roles":[],"etat":"disponible","ressenti":null}]}"""

            kv.set(BLOB_KEY, VaultCrypto.encrypt(legacyVaultJson, key))
            kv.set(VERSION_KEY, "1")
            // Land directly on Carte (ONB-08 resume gate) — the point of the
            // test is post-onboarding decode of an old blob, not onboarding.
            kv.set(STEP_KEY, "complete")
        }
    }
}
