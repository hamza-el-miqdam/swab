package com.swab.android

import android.app.Application
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
