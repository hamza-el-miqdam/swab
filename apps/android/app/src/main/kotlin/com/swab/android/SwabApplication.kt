package com.swab.android

import android.app.Application
import android.content.Context
import com.swab.android.observability.LogcatLogger
import com.swab.android.observability.NoopLogger
import com.swab.android.observability.SwabLogger

/**
 * SUG-AND-012 — G3's "single error-boundary reporter", minimum viable: a
 * default [Thread.UncaughtExceptionHandler] that logs the crash's exception
 * type only (never a message/stack that could embed user data), then
 * rethrows to the platform's prior handler so the crash still surfaces
 * normally (Play Vitals, adb logcat, process death). A full crash-reporting
 * SaaS is out of scope — new dependency, no G4 justification here.
 */
class SwabApplication : Application() {
    /**
     * The ONE [AppContainer] for the whole process (SUG-AND-001 review F3).
     *
     * It used to be built per `MainActivity.onCreate`, which is a real bug
     * now that lifecycle callbacks drive sync: `viewModel { }` initializers
     * do NOT re-run after an Activity recreation (that is the whole point of
     * SUG-AND-003), so after any config change the ViewModels kept writing to
     * the OLD container's `Vault` — and therefore notifying the OLD
     * `SyncScheduler` — while `onStop`/`onStart` addressed a brand-new one
     * whose `hasPendingWork` was false. Rotate, edit a fiche, press Home
     * within the debounce window, and the background trigger no-opped while
     * the edits sat on an orphaned scope: exactly the defect this work
     * exists to remove, reintroduced behind a rotation.
     *
     * `by lazy`, not built in [onCreate], so `E2ESeedHooks.apply` still runs
     * before anything can hydrate the vault (MainActivity touches the
     * container only after seeding).
     */
    val container: AppContainer by lazy { AppContainer(this) }

    companion object {
        /** The process-wide container. Every caller must go through here. */
        fun from(context: Context): AppContainer =
            (context.applicationContext as SwabApplication).container
    }

    override fun onCreate() {
        super.onCreate()
        val logger: SwabLogger = if (BuildConfig.DEBUG) LogcatLogger() else NoopLogger()
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            logger.event(SwabLogger.Level.ERROR, "app.crash", mapOf("type" to throwable.javaClass.simpleName))
            previousHandler?.uncaughtException(thread, throwable)
        }
    }
}
