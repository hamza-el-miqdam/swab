package com.swab.android.e2e

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Issue #128 regression coverage for the pure pacing decision behind
 * [OtpRateGate]. Plain JUnit, no Compose/Activity dependency, no real
 * sleeping — every case below asserts on [nextWaitMillis] directly with an
 * injected clock value, which is what actually needs to be correct for the
 * gate to keep the E2E suite's OTP-route call rate under IDT-03's real
 * server-side limit (10 requests / 60 s) without ever padding a UI-facing
 * timeout.
 */
class OtpRateGateTest {

    @Test
    fun test_ISSUE128_noWaitWhenUnderTheCap() {
        val calls = listOf(1_000L, 2_000L, 3_000L)
        assertNull(nextWaitMillis(calls, now = 4_000L, max = 9, windowMillis = 60_000L))
    }

    @Test
    fun test_ISSUE128_noWaitWhenTheWindowIsEmpty() {
        assertNull(nextWaitMillis(emptyList(), now = 0L, max = 9, windowMillis = 60_000L))
    }

    @Test
    fun test_ISSUE128_waitsUntilTheOldestInWindowCallAgesOutPlusSafetyMargin() {
        // 9 calls at t=0 fills the cap of 9; "now" is 10s later.
        val calls = List(9) { 0L }
        val wait = nextWaitMillis(calls, now = 10_000L, max = 9, windowMillis = 60_000L, safetyMarginMillis = 1_500L)
        // oldest ages out at t=60_000; + 1_500 margin - now(10_000) = 51_500
        assertEquals(51_500L, wait)
    }

    @Test
    fun test_ISSUE128_callsOutsideTheWindowAreNotCountedAgainstTheCap() {
        // One call happened 70s ago (already outside the 60s window) plus
        // 8 recent ones — that's 8 in-window, under the cap of 9.
        val calls = listOf(-70_000L) + List(8) { 0L }
        assertNull(nextWaitMillis(calls, now = 10_000L, max = 9, windowMillis = 60_000L))
    }

    @Test
    fun test_ISSUE128_noWaitOnceTheWindowAndMarginHaveFullyElapsed() {
        // At exactly oldest + windowMillis (= 60_000) the entry already stops
        // counting as "in window" (the filter is `now - it < windowMillis`),
        // so the whole cohort drops out of the count before the safety-margin
        // arithmetic even runs — this is correctly a free slot (null), not a
        // wait of exactly 0. (A prior version of this test wrongly asserted
        // 0L here; the algebra can never produce exactly 0 from the wait
        // formula while margin > 0, since an entry still counted as in-window
        // always has `windowMillis - elapsed > 0`, so `+ safetyMarginMillis`
        // keeps the result strictly positive. The `coerceAtLeast(0)` clamp is
        // deliberate defensive coding for a negative margin, not something a
        // caller can hit with the default positive margin.)
        val calls = List(9) { 0L }
        val wait = nextWaitMillis(calls, now = 61_500L, max = 9, windowMillis = 60_000L, safetyMarginMillis = 1_500L)
        assertNull(wait)
    }

    /**
     * Issue #128 (process-isolation regression): exercises the REAL
     * persistence round-trip behind [OtpRateGate.awaitSlot] directly via its
     * `internal` [OtpRateGate.readTimestamps]/[OtpRateGate.writeTimestamps],
     * not just the pure [nextWaitMillis] decision above. This is the fast,
     * isolated repro that should have caught both prior broken versions:
     * a raw-`File` version threw `FileNotFoundException ... ENOENT` here,
     * and a `PlatformTestStorageRegistry` version silently returned an empty
     * read after a successful write (openInputFile/openOutputFile are
     * asymmetric channels, not a shared store) — a bug that a test only
     * calling [OtpRateGate.awaitSlot] under the cap could NOT catch, because
     * a wrongly-empty read and a correct one both produce `wait=null` when
     * under the cap. Asserting the exact written values round-trip is what
     * makes this test meaningful; one call here takes a fraction of a
     * second instead of the ~1 minute a full suite run costs.
     */
    @Test
    fun test_ISSUE128_writtenTimestampsRoundTripThroughReadAcrossCalls() {
        OtpRateGate.reset()
        assertEquals(emptyList<Long>(), OtpRateGate.readTimestamps())

        OtpRateGate.writeTimestamps(listOf(100L, 200L, 300L))
        // A fresh read call must see exactly what the prior call wrote —
        // this is the assertion the broken PlatformTestStorageRegistry
        // version could not satisfy (it always came back empty here).
        assertEquals(listOf(100L, 200L, 300L), OtpRateGate.readTimestamps())

        OtpRateGate.reset()
        assertEquals(emptyList<Long>(), OtpRateGate.readTimestamps())
    }

    /**
     * Smoke-tests the public [OtpRateGate.awaitSlot] entry point end to end
     * (decision + persistence together) for the ordinary under-the-cap path,
     * asserting it returns promptly rather than blocking.
     */
    @Test
    fun test_ISSUE128_awaitSlotDoesNotBlockWhenUnderTheCap() {
        OtpRateGate.reset()
        val start = System.currentTimeMillis()
        OtpRateGate.awaitSlot()
        OtpRateGate.awaitSlot()
        val elapsed = System.currentTimeMillis() - start
        assertEquals(true, elapsed < 5_000L)
        OtpRateGate.reset()
    }
}
