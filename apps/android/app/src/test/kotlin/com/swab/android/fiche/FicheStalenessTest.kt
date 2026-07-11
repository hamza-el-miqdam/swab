package com.swab.android.fiche

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FS-03 FCH-05 — staleness nudge timing, pure logic. */
class FicheStalenessTest {

    private val day = 24L * 60 * 60 * 1000
    private val period = FicheStaleness.DEFAULT_STALE_PERIOD_MILLIS

    @Test
    fun `FCH-05 never edited - never stale, nothing to re-confirm`() {
        assertFalse(FicheStaleness.isStale(lastAxisChangeAt = null, staleSnoozedUntil = null, now = 10_000_000L))
    }

    @Test
    fun `FCH-05 edited well within the period - not stale`() {
        val now = 10_000_000L
        assertFalse(FicheStaleness.isStale(lastAxisChangeAt = now - day, staleSnoozedUntil = null, now = now))
    }

    @Test
    fun `FCH-05 edited exactly the default period ago - stale`() {
        val now = period + 1_000_000L
        assertTrue(FicheStaleness.isStale(lastAxisChangeAt = now - period, staleSnoozedUntil = null, now = now))
    }

    @Test
    fun `FCH-05 well past the period with no snooze - stale`() {
        val now = period * 2
        assertTrue(FicheStaleness.isStale(lastAxisChangeAt = 0L, staleSnoozedUntil = null, now = now))
    }

    @Test
    fun `FCH-05 stale but snoozed - suppressed until snooze expires`() {
        val lastEdit = 0L
        val now = period * 2 // long past staleness
        val snoozedUntil = now + day // snooze still active
        assertFalse(FicheStaleness.isStale(lastAxisChangeAt = lastEdit, staleSnoozedUntil = snoozedUntil, now = now))
    }

    @Test
    fun `FCH-05 snooze that has expired - stale again, re-eligible`() {
        val lastEdit = 0L
        val now = period * 2
        val snoozedUntil = now - 1 // expired a moment ago
        assertTrue(FicheStaleness.isStale(lastAxisChangeAt = lastEdit, staleSnoozedUntil = snoozedUntil, now = now))
    }
}
