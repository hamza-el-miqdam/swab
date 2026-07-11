package com.swab.android

import android.content.Context
import android.content.Intent

/**
 * Release variant of the E2E seed hook: a guaranteed no-op. The real
 * implementation lives ONLY in `src/debug/kotlin` — see that file's header
 * for the full release-safety argument. This variant exists so `src/main`'s
 * single call site compiles in every build type while the seeding code is
 * physically absent from release APKs.
 */
object E2ESeedHooks {
    @Suppress("UNUSED_PARAMETER")
    fun apply(intent: Intent?, context: Context) {
        // Intentionally empty — test seed hooks do not exist in release.
    }
}
