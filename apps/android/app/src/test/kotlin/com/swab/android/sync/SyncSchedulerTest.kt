package com.swab.android.sync

import com.swab.android.network.ApiClient
import com.swab.android.network.HttpResponse
import com.swab.android.network.HttpTransport
import com.swab.android.observability.RecordingLogger
import com.swab.android.observability.SwabLogger
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultSync
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * VLT-04 sync triggers (SUG-AND-001). Before this suite existed the app had
 * exactly ONE trigger — a single `syncVault()` on the onboarding Done screen,
 * with no retry — so every later axis edit stayed on the device forever and a
 * failed first push was never retried.
 *
 * Time is virtual throughout (`runTest` + `backgroundScope`): the debounce is
 * a `delay`, so the scheduler's clock is the injected dispatcher's, never the
 * wall clock. No test here sleeps.
 *
 * `advanceUntilIdle()` is deliberately absent from this file. Since
 * kotlinx-coroutines-test 1.7 it returns as soon as no *foreground* task is
 * left, and the scheduler launches into `backgroundScope` — as the real one
 * launches into an AppContainer-owned scope — so it comes back without ever
 * dispatching the flush, and every assertion resting on it passes vacuously.
 * That was caught here, on the first red run. Use `runCurrent()` /
 * `advanceTimeBy()`, which do dispatch background work.
 */
class SyncSchedulerTest {

    /** Counts flushes; the first [failures] of them throw, like an offline push. */
    private class RecordingPendingSync(failures: Int = 0) : PendingSync {
        var flushes = 0
            private set
        private var remainingFailures = failures

        override suspend fun flush() {
            flushes++
            if (remainingFailures > 0) {
                remainingFailures--
                throw IOException("network unreachable")
            }
        }
    }

    /** Records every request the real VaultSync path makes; always answers 200. */
    private class RecordingTransport : HttpTransport {
        val requests = mutableListOf<Pair<String, String>>()

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            requests += method to url
            return HttpResponse(200, """{"blob":"x","version":9}""")
        }
    }

    // ---------------------------------------------------------- debounce

    @Test
    fun test_VLT04_writeBurst_coalescesIntoASingleFlushAfterTheDebounceWindow() = runTest {
        val pending = RecordingPendingSync()
        val scheduler = SyncScheduler(pending, backgroundScope, debounceMillis = 30_000L)

        // Five chip taps across 10s of virtual time — the fiche's real write
        // pattern (every `recordAxisEdit` persists). Writes land at T=0…8s.
        repeat(5) {
            scheduler.onWrite()
            advanceTimeBy(2_000)
        }
        runCurrent()
        assertEquals("no push may happen during the burst", 0, pending.flushes)
        assertTrue("the burst must be remembered as pending work", scheduler.hasPendingWork)

        // The window restarts on every write, so it closes 30s after the LAST
        // one (T=38s) — 28s from here, not 30s.
        advanceTimeBy(27_999)
        runCurrent()
        assertEquals("still inside the window", 0, pending.flushes)

        advanceTimeBy(1)
        runCurrent()
        assertEquals("the whole burst must collapse into one push", 1, pending.flushes)
        assertFalse(scheduler.hasPendingWork)
    }

    @Test
    fun test_VLT04_singleWrite_doesNotFlushBeforeTheDebounceElapses() = runTest {
        val pending = RecordingPendingSync()
        val scheduler = SyncScheduler(pending, backgroundScope, debounceMillis = 30_000L)

        scheduler.onWrite()
        advanceTimeBy(29_000)
        runCurrent()

        assertEquals(0, pending.flushes)
    }

    // ------------------------------------------------- immediate triggers

    @Test
    fun test_VLT04_appBackground_cancelsThePendingDebounceAndFlushesImmediately() = runTest {
        val pending = RecordingPendingSync()
        val scheduler = SyncScheduler(pending, backgroundScope, debounceMillis = 30_000L)

        scheduler.onWrite()
        advanceTimeBy(1_000)
        scheduler.onAppBackground()
        runCurrent()

        assertEquals("backgrounding must not wait out the debounce", 1, pending.flushes)

        // …and the debounce it cancelled must not fire a second, redundant push.
        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(1, pending.flushes)
        assertFalse(scheduler.hasPendingWork)
    }

    @Test
    fun test_VLT04_appBackground_withNothingPending_pushesNothing() = runTest {
        val pending = RecordingPendingSync()
        val scheduler = SyncScheduler(pending, backgroundScope)

        scheduler.onAppBackground()
        advanceTimeBy(60_000)
        runCurrent()

        // The blob is unchanged, and the server bumps the stored version on
        // every accepted write — re-pushing identical bytes on each
        // backgrounding would churn versions for nothing.
        assertEquals(0, pending.flushes)
    }

    @Test
    fun test_VLT04_syncNow_flushesImmediatelyEvenWithNoPendingWork() = runTest {
        val pending = RecordingPendingSync()
        val scheduler = SyncScheduler(pending, backgroundScope)

        // The post-onboarding trigger: the server may hold no vault at all
        // yet, so this one is unconditional.
        scheduler.syncNow()
        runCurrent()

        assertEquals(1, pending.flushes)
    }

    // -------------------------------------------------- failure + retry

    @Test
    fun test_VLT04_failedFlush_marksPending_andTheNextTriggerRetries() = runTest {
        val pending = RecordingPendingSync(failures = 1)
        val logger = RecordingLogger()
        val scheduler = SyncScheduler(pending, backgroundScope, logger = logger)

        scheduler.onWrite()
        advanceTimeBy(SyncScheduler.DEFAULT_DEBOUNCE_MILLIS)
        runCurrent()

        assertEquals(1, pending.flushes)
        assertTrue("a failed push must stay queued", scheduler.hasPendingWork)
        assertTrue(
            "the failure must be logged, never surfaced to the UI",
            logger.events.any { it.level == SwabLogger.Level.WARN },
        )
        // G3: type name only — no blob, no version, no user data.
        assertFalse(logger.loggedStrings().any { it.contains("blob") })

        // Foreground again (the reconnect proxy): the queued work is retried.
        scheduler.onAppForeground()
        runCurrent()

        assertEquals(2, pending.flushes)
        assertFalse(scheduler.hasPendingWork)

        // Nothing left to do — the next foreground is a no-op.
        scheduler.onAppForeground()
        runCurrent()
        assertEquals(2, pending.flushes)
    }

    @Test
    fun test_VLT04_failedFlush_neverThrowsOutOfTheScheduler() = runTest {
        val pending = RecordingPendingSync(failures = 1)
        val scheduler = SyncScheduler(pending, backgroundScope)

        scheduler.syncNow()
        runCurrent()

        // Reaching here at all is the assertion: an offline push must not take
        // the app's scope down with it (and no error banner — product ethos).
        assertEquals(1, pending.flushes)
    }

    @Test
    fun test_VLT04_anErrorFromTheFlush_neverEscapesAndKillsTheProcess() = runTest {
        // The Done screen's `runCatching` caught Throwable; the scheduler that
        // replaced it must too. This scope has no supervisor above it, so an
        // escape would reach SwabApplication's handler — which rethrows — and
        // kill the app in the background for a failed push.
        val exploding = object : PendingSync {
            var calls = 0
                private set

            override suspend fun flush() {
                calls++
                throw NoClassDefFoundError("simulated VM-level failure inside the push")
            }
        }
        val scheduler = SyncScheduler(exploding, backgroundScope)

        scheduler.syncNow()
        runCurrent()

        assertEquals(1, exploding.calls)
        assertTrue("the failed push must stay queued", scheduler.hasPendingWork)

        // The scope is still usable — the failure did not cancel it.
        scheduler.onAppForeground()
        runCurrent()
        assertEquals(2, exploding.calls)
    }

    @Test
    fun test_VLT04_aWriteLandingDuringAnInFlightPush_isNotSwallowedByItsSuccess() = runTest {
        // The bug this pins: with a boolean "dirty" latch, a push that STARTED
        // before the edit cleared the flag on success, so the edit looked
        // synced. Backgrounding then cancelled its debounce and skipped the
        // flush on that same stale flag — the edit stayed on the device
        // indefinitely, which is the entire class of defect SUG-AND-001 is
        // about.
        val gate = CompletableDeferred<Unit>()
        val pending = object : PendingSync {
            var flushes = 0
                private set

            override suspend fun flush() {
                flushes++
                if (flushes == 1) gate.await() // park inside the first push
            }
        }
        val scheduler = SyncScheduler(pending, backgroundScope, debounceMillis = 30_000L)

        scheduler.syncNow()
        runCurrent()
        assertEquals("the first push must be in flight", 1, pending.flushes)

        scheduler.onWrite() // the user edits a fiche while that push is in flight
        runCurrent()

        gate.complete(Unit) // the in-flight push now succeeds
        runCurrent()

        assertTrue("a write made during a push is not covered by it", scheduler.hasPendingWork)

        scheduler.onAppBackground()
        runCurrent()
        assertEquals("the mid-push write must still be pushed", 2, pending.flushes)
        assertFalse(scheduler.hasPendingWork)
    }

    // ------------------------------------------- ONB-05 onboarding window

    @Test
    fun test_ONB05_nothingFlushesUntilOnboardingCompletes() = runTest {
        val pending = RecordingPendingSync()
        var onboardingComplete = false
        val scheduler = SyncScheduler(
            pending,
            backgroundScope,
            isEnabled = { onboardingComplete },
        )

        // Every trigger, all of them while onboarding is still running.
        scheduler.onWrite()
        advanceTimeBy(60_000)
        runCurrent()
        scheduler.onAppBackground()
        runCurrent()
        scheduler.onAppForeground()
        runCurrent()
        scheduler.syncNow()
        runCurrent()

        assertEquals("zero classification data may leave the device during onboarding", 0, pending.flushes)
        assertTrue("the writes are queued, not dropped", scheduler.hasPendingWork)

        onboardingComplete = true
        scheduler.syncNow()
        runCurrent()

        assertEquals("the queued onboarding writes go out once the gate opens", 1, pending.flushes)
        assertFalse(scheduler.hasPendingWork)
    }

    // -------------------------------------------------- wired end to end

    @Test
    fun test_VLT04_realVaultWrites_reachTheTransportExactlyOncePerBurst() = runTest {
        val kv = InMemoryKeyValueStore()
        val transport = RecordingTransport()
        lateinit var scheduler: SyncScheduler
        val vault = Vault(kv, InMemoryVaultKeyStore(), onPersist = { scheduler.onWrite() })
        val vaultSync = VaultSync(vault, ApiClient(transport, baseUrl = "http://test"))
        scheduler = SyncScheduler(vaultSync, backgroundScope, debounceMillis = 30_000L)

        val contact = vault.addContact("Nadia")
        vault.setRing(contact.id, 1)
        vault.recordAxisEdit(contact.id, "intimite", "ring", at = 1_000L)
        advanceTimeBy(5_000)
        runCurrent()

        assertEquals("writes alone must not hit the network", 0, transport.requests.size)

        advanceTimeBy(30_000)
        runCurrent()

        assertEquals(listOf("POST" to "http://test/vault"), transport.requests)
    }
}
