package com.swab.android.sync

import com.swab.android.observability.NoopLogger
import com.swab.android.observability.SwabLogger
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Work waiting to leave the device. Today the only implementation is
 * `VaultSync` (one whole-blob push); after the ADR-001 stage-4 migration it
 * becomes the durable per-record outbox (VLT-10). The scheduler is written
 * against THIS, never against a vault or an ApiClient, so the triggers below
 * survive that swap untouched.
 */
interface PendingSync {
    suspend fun flush()
}

/**
 * FS-07 VLT-10 — *when* pending local work is replayed, decoupled from *what*
 * that work is (SUG-AND-001).
 *
 * **What the spec actually requires.** VLT-10: "Offline writes queue in a
 * durable local outbox and replay **in order** on reconnect." FS-01
 * acceptance 1: placements made in airplane mode "sync to the server when
 * connectivity returns, with no data loss". Before this class the app pushed
 * from exactly one place — the onboarding Done screen — so every fiche edit
 * made afterwards stayed on the device forever, and a single failed
 * onboarding push was never retried.
 *
 * **The specific triggers below are engineering choices, not requirements.**
 * FS-07's VLT-04 named "app background, post-onboarding, after any vault
 * write burst (debounced ≥30s)" until commit `ab3f241` (2026-08-16, ADR-001)
 * replaced it with the local-cache wording it carries now. The current spec
 * names no trigger and no interval. Post-onboarding, background, and a 30 s
 * debounce are this client's approximation of "on reconnect" while it has no
 * reachability callback — change them freely if a better approximation
 * appears; only the VLT-10 guarantee is binding.
 *  - **after a write burst**, debounced ([DEFAULT_DEBOUNCE_MILLIS]) — the
 *    fiche persists on every chip tap, so an editing session must collapse
 *    into one push, not one per tap;
 *  - **app background** ([onAppBackground]) — the debounce is cancelled and
 *    queued work goes out now, because the process may not survive to see the
 *    timer fire;
 *  - **post-onboarding** ([syncNow]) — unconditional: the server may hold no
 *    vault at all yet.
 *
 * Plus [onAppForeground], a poor-man's reconnect trigger: a push that failed
 * offline stays queued and is retried the next time the app comes back to the
 * front. (A real `ConnectivityManager` callback is deliberately NOT wired —
 * see the changelog; it needs a lifecycle-aware registration and belongs with
 * the stage-4 outbox.)
 *
 * **This is not the durable outbox VLT-10 asks for.** The queue counters live
 * in memory; durability arrives with ADR-001 stage 4. [assumePendingFromPreviousSession]
 * is the honest stopgap.
 *
 * No Android imports: this is plain-JVM testable with virtual time, like the
 * rest of the domain layer.
 *
 * Failures are silent by design (product ethos: nothing alarming). They are
 * logged at WARN with the exception *type* only (G3) and re-queued.
 */
class SyncScheduler(
    private val pending: PendingSync,
    /**
     * Must outlive any ViewModel — a debounce started by a fiche edit has to
     * survive leaving the fiche. `AppContainer` owns it.
     */
    private val scope: CoroutineScope,
    private val debounceMillis: Long = DEFAULT_DEBOUNCE_MILLIS,
    /**
     * ONB-05 gate. Nothing may leave the device before onboarding completes —
     * the privacy-invariant tests assert zero classification data on the wire
     * during onboarding, and that is current, correct behaviour. Writes made
     * during onboarding are *queued*, not dropped: the post-onboarding
     * [syncNow] flushes them.
     */
    private val isEnabled: suspend () -> Boolean = { true },
    private val logger: SwabLogger = NoopLogger(),
    /**
     * Monotonic clock for the backoff window. `nanoTime`, not
     * `currentTimeMillis`: a wall-clock jump must not turn a one-minute
     * cool-off into an hour (or vice versa). Tests inject virtual time.
     */
    private val nowMillis: () -> Long = { System.nanoTime() / 1_000_000 },
) {
    companion object {
        /**
         * Debounce window. An engineering choice, not a spec constant — see
         * the header: the current FS-07 names no interval.
         */
        const val DEFAULT_DEBOUNCE_MILLIS: Long = 30_000L

        /**
         * Backoff for a push that keeps failing the same way. One free retry
         * (a first failure is very often transient — a tunnel, a locked
         * Keystore), then doubling from a minute to a one-hour cap.
         *
         * Without this, a permanently-failing push is retried on EVERY
         * trigger, and issue #127 means the first push of every new account
         * can never succeed: with `onStart` and `onStop` both wired, each
         * app switch cost six doomed requests, forever. Failures are still
         * reported (G3) — they are just not re-attempted on a hair trigger.
         * Mirrors the iOS scheduler's values so the two platforms behave
         * alike for the same requirement.
         */
        const val BACKOFF_BASE_MILLIS: Long = 60_000L
        const val BACKOFF_CAP_MILLIS: Long = 3_600_000L

        internal fun backoffDelayMillis(consecutiveFailures: Int): Long {
            if (consecutiveFailures < 2) return 0L
            val doublings = minOf(consecutiveFailures - 2, 16)
            return minOf(BACKOFF_BASE_MILLIS shl doublings, BACKOFF_CAP_MILLIS)
        }
    }

    /** Serialises flushes so two triggers can't push the same state twice concurrently. */
    private val flushMutex = Mutex()

    /** Guards [debounceTimerJob] only — triggers are called from the main thread and from vault writes on other dispatchers. */
    private val jobLock = Any()
    private var debounceTimerJob: Job? = null

    /**
     * Local writes so far, and the count the server has accepted. They differ
     * exactly when something is queued.
     *
     * A boolean "dirty" flag is NOT enough and was the first version of this
     * class: a write landing *during* an in-flight push was cleared by that
     * push's success, even though the push carried the older state. The next
     * backgrounding then cancelled the debounce and skipped the flush on that
     * stale flag, and the edit never left the device — the exact defect this
     * whole change exists to fix. Snapshotting the sequence before the push
     * and only crediting that snapshot afterwards closes it.
     */
    private val writeSeq = AtomicLong(0)
    private val syncedSeq = AtomicLong(0)

    /** Set when a push fails, so a retry happens even with no new writes. */
    @Volatile
    private var lastFlushFailed: Boolean = false

    /**
     * Consecutive failures of the SAME kind, and the instant before which no
     * further attempt is made. A different failure type resets the count — a
     * changed failure mode is new information, not more of the same.
     */
    @Volatile
    private var consecutiveFailures: Int = 0

    @Volatile
    private var lastFailureType: String? = null

    @Volatile
    private var retryNotBefore: Long? = null

    /** True while a repeatedly-failing push is cooling off. */
    val isBackingOff: Boolean
        get() = retryNotBefore?.let { nowMillis() < it } ?: false

    /** Is there local state the server hasn't accepted yet? (Also the retry latch.) */
    val hasPendingWork: Boolean get() = lastFlushFailed || writeSeq.get() != syncedSeq.get()

    /**
     * Assume something is queued (FS-01 acceptance 1). Called at process
     * start once the persisted step says onboarding is finished: a push that
     * a previous session never landed leaves no in-memory trace — `writeSeq`
     * and `lastFlushFailed` die with the process — so without this the
     * airplane-mode onboarding case never syncs on the next launch, because
     * both cross-session triggers guard on [hasPendingWork]. The cost of
     * being wrong is one redundant push per app session; the cost of the
     * opposite is silent data loss. Mirrors iOS `SyncScheduler.activate()`.
     *
     * NOT durability: the real fix is VLT-10's durable outbox (ADR-001
     * stage 4). This is the honest approximation available without one.
     */
    fun assumePendingFromPreviousSession() {
        writeSeq.incrementAndGet()
    }

    /** Write-burst trigger — call on every persisted local write. */
    fun onWrite() {
        writeSeq.incrementAndGet()
        synchronized(jobLock) {
            debounceTimerJob?.cancel()
            debounceTimerJob = scope.launch {
                delay(debounceMillis)
                // The flush is its own job on the SCOPE, not a child of this
                // timer: cancelling the timer must never cancel a push
                // already in flight. It used to, and an accepted server write
                // whose local `setVaultVersion` got cancelled left the client
                // 409-ing on every later push.
                scope.launch { flush() }
            }
        }
    }

    /** Post-onboarding trigger — flushes immediately, pending work or not. */
    fun syncNow() {
        cancelDebounceTimer()
        scope.launch { flush() }
    }

    /**
     * App-background trigger. Cancels the debounce and pushes what is
     * queued. Deliberately a no-op when nothing is queued: the server bumps
     * the stored version on every accepted write, so re-pushing identical
     * bytes on each backgrounding would churn versions for nothing.
     */
    fun onAppBackground() {
        if (!hasPendingWork || isBackingOff) return
        cancelDebounceTimer()
        scope.launch { flush() }
    }

    /**
     * Retry latch: a push that failed while offline goes out when the app
     * returns. Cancels the debounce timer too — without that, a successful
     * flush here left the still-armed timer to fire 30 s later and push
     * byte-identical state a second time.
     */
    fun onAppForeground() {
        if (!hasPendingWork || isBackingOff) return
        cancelDebounceTimer()
        scope.launch { flush() }
    }

    private fun cancelDebounceTimer() {
        synchronized(jobLock) {
            debounceTimerJob?.cancel()
            debounceTimerJob = null
        }
    }

    private suspend fun flush() {
        flushMutex.withLock {
            if (!isEnabled()) return // ONB-05 — stays queued, nothing on the wire
            if (isBackingOff) return // cooling off after repeated identical failures
            // Snapshot BEFORE the push: anything written while it is in flight
            // is not covered by it and must stay queued (see [writeSeq]).
            val coveredSeq = writeSeq.get()
            try {
                pending.flush()
                syncedSeq.set(coveredSeq)
                lastFlushFailed = false
                consecutiveFailures = 0
                lastFailureType = null
                retryNotBefore = null
            } catch (cancellation: CancellationException) {
                lastFlushFailed = true // an interrupted push did not land
                throw cancellation
            } catch (t: Throwable) {
                // Throwable, not Exception, and deliberately so: this replaced
                // a `runCatching` on the Done screen, which caught Throwable.
                // Narrowing it would have been a silent crash regression —
                // this runs in a container-owned scope with no supervisor
                // above it, so ANY escape reaches SwabApplication's default
                // handler, which rethrows, and the process dies. A background
                // push must never be able to take the app down. Cancellation
                // is re-thrown above, so it stays real cancellation.
                //
                // Offline is the normal case here, not an error state: keep it
                // queued, keep the UI silent, log the type only (G3 — never
                // the blob, a version, or anything from the vault).
                lastFlushFailed = true
                val type = t.javaClass.simpleName
                consecutiveFailures = if (type == lastFailureType) consecutiveFailures + 1 else 1
                lastFailureType = type
                val cooloff = backoffDelayMillis(consecutiveFailures)
                retryNotBefore = if (cooloff == 0L) null else nowMillis() + cooloff
                logger.event(
                    SwabLogger.Level.WARN,
                    "sync.flush.failed",
                    mapOf("type" to type, "consecutive" to consecutiveFailures),
                )
            }
        }
    }
}
