package com.swab.android.observability

import android.util.Log

/**
 * SUG-AND-012 / G3 logger seam. Event names only + a whitelisted map of
 * scalar fields — deliberately narrow so leaking is hard. NEVER pass a
 * free-form message string built from user data, and never put a
 * displayName, phoneHash, session token, or vault blob/plaintext in
 * [fields]; counts, ids, and enum-ish type names are fine.
 */
interface SwabLogger {
    fun event(level: Level, name: String, fields: Map<String, Any?> = emptyMap())

    enum class Level { DEBUG, INFO, WARN, ERROR }
}

/**
 * Debug builds only (wired in `AppContainer`/`SwabApplication`) — logcat is
 * readable over adb (and, pre-API 30, by any app holding READ_LOGS), so this
 * must never be the release logger.
 */
class LogcatLogger(private val tag: String = "Swab") : SwabLogger {
    override fun event(level: SwabLogger.Level, name: String, fields: Map<String, Any?>) {
        val message = if (fields.isEmpty()) {
            name
        } else {
            name + " " + fields.entries.joinToString(" ") { (key, value) -> "$key=$value" }
        }
        when (level) {
            SwabLogger.Level.DEBUG -> Log.d(tag, message)
            SwabLogger.Level.INFO -> Log.i(tag, message)
            SwabLogger.Level.WARN -> Log.w(tag, message)
            SwabLogger.Level.ERROR -> Log.e(tag, message)
        }
    }
}

/** Release default until a real reporter exists (SUG-AND-012 risk note); also the JVM-test default. */
class NoopLogger : SwabLogger {
    override fun event(level: SwabLogger.Level, name: String, fields: Map<String, Any?>) {}
}
