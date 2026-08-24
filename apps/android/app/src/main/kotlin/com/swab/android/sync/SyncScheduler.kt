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
 * FS-07 VLT-04 — when queued work actually leaves the device (SUG-AND-001).
 *
 * Three triggers, exactly as the requirement lists them:
 *  - **after a write burst**, debounced ([DEFAULT_DEBOUNCE_MILLIS], ≥30s per
 *    VLT-04) — the fiche persists on every chip tap, so an editing session
 *    must collapse into one push, not one per tap;
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
) {
    companion object {
        /** VLT-04: "after any vault write burst (debounced ≥30s)". */
        const val DEFAULT_DEBOUNCE_MILLIS: Long = 30_000L
    }

    /** Serialises flushes so two triggers can't push the same state twice concurrently. */
    private val flushMutex = Mutex()

    /** Guards [debounceJob] only — triggers are called from the main thread and from vault writes on other dispatchers. */
    private val jobLock = Any()
    private var debounceJob: Job? = null

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

    /** Is there local state the server hasn't accepted yet? (Also the retry latch.) */
    val hasPendingWork: Boolean get() = lastFlushFailed || writeSeq.get() != syncedSeq.get()

    /** VLT-04 write-burst trigger — call on every persisted local write. */
    fun onWrite() {
        writeSeq.incrementAndGet()
        synchronized(jobLock) {
            debounceJob?.cancel()
            debounceJob = scope.launch {
                delay(debounceMillis)
                flush()
            }
        }
    }

    /** VLT-04 post-onboarding trigger — flushes immediately, pending work or not. */
    fun syncNow() {
        cancelDebounce()
        scope.launch { flush() }
    }

    /**
     * VLT-04 app-background trigger. Cancels the debounce and pushes what is
     * queued. Deliberately a no-op when nothing is queued: the server bumps
     * the stored version on every accepted write, so re-pushing identical
     * bytes on each backgrounding would churn versions for nothing.
     */
    fun onAppBackground() {
        if (!hasPendingWork) return
        cancelDebounce()
        scope.launch { flush() }
    }

    /** Retry latch: a push that failed while offline goes out when the app returns. */
    fun onAppForeground() {
        if (!hasPendingWork) return
        scope.launch { flush() }
    }

    private fun cancelDebounce() {
        synchronized(jobLock) {
            debounceJob?.cancel()
            debounceJob = null
        }
    }

    private suspend fun flush() {
        flushMutex.withLock {
            if (!isEnabled()) return // ONB-05 — stays queued, nothing on the wire
            // Snapshot BEFORE the push: anything written while it is in flight
            // is not covered by it and must stay queued (see [writeSeq]).
            val coveredSeq = writeSeq.get()
            try {
                pending.flush()
                syncedSeq.set(coveredSeq)
                lastFlushFailed = false
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
                logger.event(
                    SwabLogger.Level.WARN,
                    "sync.flush.failed",
                    mapOf("type" to t.javaClass.simpleName),
                )
            }
        }
    }
}
