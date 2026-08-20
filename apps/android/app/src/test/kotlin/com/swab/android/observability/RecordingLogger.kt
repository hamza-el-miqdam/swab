package com.swab.android.observability

/** Test double: records every event verbatim so tests can assert on its contents. */
class RecordingLogger : SwabLogger {
    data class Event(val level: SwabLogger.Level, val name: String, val fields: Map<String, Any?>)

    val events = mutableListOf<Event>()

    override fun event(level: SwabLogger.Level, name: String, fields: Map<String, Any?>) {
        events += Event(level, name, fields)
    }

    /** Every string that appeared anywhere in a logged event — the surface a privacy test scans. */
    fun loggedStrings(): List<String> = events.flatMap { listOf(it.name) + it.fields.values.map { v -> v.toString() } }
}
