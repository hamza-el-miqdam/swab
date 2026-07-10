package com.swab.android.fiche

/**
 * FS-03 FCH-05 — staleness nudge timing. Pure Kotlin, no Android imports (same
 * rule as carte/MapGeometry.kt) so it's JVM-testable without Robolectric.
 *
 * ⚠️ ASSUMPTION (spec FCH-05 flags this itself): the 6-month default period is
 * not a confirmed product decision — [DEFAULT_STALE_PERIOD_MILLIS] is a
 * provisional number for the walking skeleton, expected to be revisited.
 */
object FicheStaleness {
    private const val DAY_MILLIS: Long = 24L * 60 * 60 * 1000

    /** ~6 months. ⚠️ ASSUMPTION — see file header. */
    const val DEFAULT_STALE_PERIOD_MILLIS: Long = 182L * DAY_MILLIS

    /**
     * True when the relation is due for a re-tag nudge: an axis was edited at
     * least once (nothing to "re-confirm" for a never-touched contact), that
     * edit is older than [period], and no active « À revoir plus tard »
     * snooze covers [now].
     */
    fun isStale(
        lastAxisChangeAt: Long?,
        staleSnoozedUntil: Long?,
        now: Long,
        period: Long = DEFAULT_STALE_PERIOD_MILLIS,
    ): Boolean {
        if (lastAxisChangeAt == null) return false
        if (staleSnoozedUntil != null && now < staleSnoozedUntil) return false
        return now - lastAxisChangeAt >= period
    }
}
