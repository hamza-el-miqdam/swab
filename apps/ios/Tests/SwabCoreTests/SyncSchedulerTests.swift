/// FS-07 VLT-04 sync triggers (SUG-IOS-002): post-onboarding, app
/// background, and a write burst debounced ≥ 30 s — plus the ONB-05 gate
/// that keeps every one of them silent until onboarding closes.
///
/// Everything here runs on injected `now`/`sleep` seams (`ManualClock`), so
/// no test waits out a real 30 s window and the burst-coalescing assertion
/// is a statement about the debounce, not about scheduling luck.
import Foundation
import XCTest

@testable import SwabCore

// MARK: - Doubles

/// Deterministic clock + sleeper. `sleep` parks its caller and records the
/// requested interval; `advance(by:)` moves `now` forward and wakes the
/// parked sleeper; `isSleeping` lets a test synchronise with the debounce
/// task instead of racing it. Cancellation is honoured (the background
/// trigger cancels the debounce), so a cancelled sleeper resumes by throwing
/// rather than leaking its continuation.
///
/// Lock-backed `@unchecked Sendable` rather than an actor because `now` is a
/// synchronous `@Sendable () -> Date` — the same idiom as
/// `RecordingErrorReporter` in `Tests/SwabUITests`.
private final class ManualClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date
    private var recorded: [TimeInterval] = []
    private var waiter: CheckedContinuation<Void, Error>?
    private var cancelledBeforeParking = false

    init(start: Date = Date(timeIntervalSince1970: 1_700_000_000)) {
        current = start
    }

    var now: Date {
        lock.lock()
        defer { lock.unlock() }
        return current
    }

    /// Every interval the scheduler asked to sleep for, in order.
    var requestedSleeps: [TimeInterval] {
        lock.lock()
        defer { lock.unlock() }
        return recorded
    }

    /// True while the debounce task is parked in `sleep`.
    var isSleeping: Bool {
        lock.lock()
        defer { lock.unlock() }
        return waiter != nil
    }

    func sleep(_ interval: TimeInterval) async throws {
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                lock.lock()
                recorded.append(interval)
                if cancelledBeforeParking {
                    cancelledBeforeParking = false
                    lock.unlock()
                    cont.resume(throwing: CancellationError())
                    return
                }
                waiter = cont
                lock.unlock()
            }
        } onCancel: {
            lock.lock()
            if let parked = waiter {
                waiter = nil
                lock.unlock()
                parked.resume(throwing: CancellationError())
            } else {
                cancelledBeforeParking = true
                lock.unlock()
            }
        }
    }

    func advance(by interval: TimeInterval) {
        lock.lock()
        current = current.addingTimeInterval(interval)
        let parked = waiter
        waiter = nil
        lock.unlock()
        parked?.resume()
    }
}

/// Stand-in for whatever the scheduler is pushing. Deliberately NOT a
/// `VaultSync` double: the scheduler must not know what the pending work is
/// (ADR-001 stage 4 swaps the vault blob for a durable outbox — VLT-10 —
/// and the triggers have to survive that).
private actor SpyPendingSyncWork: PendingSyncWork {
    enum Outcome: Sendable {
        case succeed
        case fail
    }

    private var outcomes: [Outcome]
    private(set) var flushCount = 0

    /// `outcomes` is consumed one per flush; once exhausted every further
    /// flush succeeds.
    init(outcomes: [Outcome] = []) {
        self.outcomes = outcomes
    }

    func flushPendingWork() async throws {
        flushCount += 1
        let outcome = outcomes.isEmpty ? Outcome.succeed : outcomes.removeFirst()
        if case .fail = outcome {
            throw SpyError.flushFailed
        }
    }

    nonisolated func reportCode(for error: Error) -> String { "spyFailure" }

    enum SpyError: Error { case flushFailed }
}

private final class RecordingReporter: ErrorReporter, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [ReportedError] = []

    var events: [ReportedError] {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }

    func report(_ event: ReportedError) {
        lock.lock()
        defer { lock.unlock() }
        storage.append(event)
    }
}

private final class NotificationCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }

    func increment() {
        lock.lock()
        count += 1
        lock.unlock()
    }
}

// MARK: - Tests

final class SyncSchedulerTests: XCTestCase {
    private func makeScheduler(
        work: SpyPendingSyncWork,
        clock: ManualClock,
        reporter: ErrorReporter = NoopErrorReporter()
    ) -> SyncScheduler {
        SyncScheduler(
            work: work,
            reporter: reporter,
            now: { clock.now },
            sleep: { try await clock.sleep($0) }
        )
    }

    /// Real-time barrier used ONLY to synchronise on a `Task` reaching a
    /// known point. Never used to wait out a debounce window — that is what
    /// `ManualClock` is for. Bounded so a broken debounce reports a failure
    /// instead of hanging the suite (found the hard way while mutation
    /// testing: an always-expired deadline made an unbounded wait spin
    /// forever rather than fail).
    private func waitUntil(
        _ description: String,
        timeout: TimeInterval = 5,
        _ condition: () async -> Bool
    ) async throws {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if await condition() { return }
            try await Task.sleep(nanoseconds: 200_000)
        }
        XCTFail("timed out waiting for: \(description)")
    }

    /// Waits for the debounce task to park in the injected sleeper.
    private func waitUntilSleeping(_ clock: ManualClock, _ what: String = "the debounce to arm") async throws {
        try await waitUntil(what) { clock.isSleeping }
    }

    // MARK: ONB-05 gate — nothing fires before onboarding closes

    /// Step 3 of the SUG-IOS-002 plan: no request may leave the device
    /// before ONB-05's onboarding-local window closes, so every trigger is
    /// inert until `activate()`. `ApiClientPrivacyInvariantTests` asserts the
    /// same promise at the payload level; this asserts it at the timing level.
    func test_ONB05_beforeActivation_noTriggerPushesAnything() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)

        await scheduler.noteLocalWrite()
        await scheduler.noteLocalWrite()

        // Not just "no push landed" — no debounce is even armed, so nothing
        // is in flight that could fire the moment the gate opens. Asserted
        // on the scheduler's own state, which `noteLocalWrite` sets
        // synchronously, and BEFORE any drain that would clear it.
        let armed = await scheduler.debounceTaskCountForTests
        XCTAssertEqual(armed, 0, "no debounce may be scheduled before activation")

        await scheduler.appDidEnterBackground()
        await scheduler.syncNow()
        clock.advance(by: 600)
        await scheduler.drainDebounceForTests()

        let count = await work.flushCount
        XCTAssertEqual(count, 0, "no sync may fire before onboarding completes (ONB-05)")
        XCTAssertTrue(clock.requestedSleeps.isEmpty, "and nothing ever slept on a debounce window")
    }

    // MARK: VLT-04 trigger 1 — post-onboarding

    func test_VLT04_onboardingCompletion_syncsImmediately() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)

        await scheduler.onboardingDidComplete()

        let count = await work.flushCount
        XCTAssertEqual(count, 1, "finishing onboarding is a VLT-04 trigger and pushes straight away")
        let needsSync = await scheduler.needsSync
        XCTAssertFalse(needsSync, "a successful push leaves nothing pending")
    }

    /// Activation without an immediate push still leaves work pending: the
    /// contacts and calibration written during onboarding — or anything a
    /// previous session failed to push — were never confirmed by the server,
    /// and nothing durable records them yet (the outbox is VLT-10).
    func test_VLT04_activationAlone_leavesWorkPendingForTheNextTrigger() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)

        await scheduler.activate()

        let count = await work.flushCount
        XCTAssertEqual(count, 0, "activation is not itself a trigger")
        let needsSync = await scheduler.needsSync
        XCTAssertTrue(needsSync)

        await scheduler.appDidEnterBackground()

        let afterBackground = await work.flushCount
        XCTAssertEqual(afterBackground, 1, "the first background of a resumed session flushes what was never confirmed")
    }

    // MARK: VLT-04 trigger 2 — write burst, debounced ≥ 30 s

    func test_VLT04_writeBurst_debouncedToSingleSyncAfterThirtySeconds() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        // Three writes spread over 20 s — all inside one debounce window.
        await scheduler.noteLocalWrite()
        try await waitUntilSleeping(clock)
        clock.advance(by: 10)
        await scheduler.noteLocalWrite()
        try await waitUntilSleeping(clock)
        clock.advance(by: 10)
        await scheduler.noteLocalWrite()
        try await waitUntilSleeping(clock)

        let midBurst = await work.flushCount
        XCTAssertEqual(midBurst, 0, "the burst must not push while writes are still arriving")

        // 30 s after the LAST write, and not a second before.
        clock.advance(by: SyncScheduler.debounceInterval - 1)
        try await waitUntilSleeping(clock)
        let justBefore = await work.flushCount
        XCTAssertEqual(justBefore, 0, "the window is measured from the last write, not the first")

        clock.advance(by: 1)
        await scheduler.drainDebounceForTests()

        let total = await work.flushCount
        XCTAssertEqual(total, 1, "a write burst coalesces into exactly one push (VLT-04)")
        XCTAssertEqual(
            clock.requestedSleeps.first,
            SyncScheduler.debounceInterval,
            "the first debounce sleep is the full window"
        )
        XCTAssertGreaterThanOrEqual(SyncScheduler.debounceInterval, 30, "VLT-04 requires ≥ 30 s")
    }

    /// Guards the plan's own gotcha: "the debounce task must be
    /// cancelled/restarted per change, not accumulated". One task, however
    /// many writes land in the window.
    func test_VLT04_writeBurst_neverAccumulatesDebounceTasks() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        for _ in 0..<5 {
            await scheduler.noteLocalWrite()
        }
        try await waitUntilSleeping(clock)

        let inFlight = await scheduler.debounceTaskCountForTests
        XCTAssertEqual(inFlight, 1, "five writes share one debounce task")

        clock.advance(by: SyncScheduler.debounceInterval)
        await scheduler.drainDebounceForTests()

        let total = await work.flushCount
        XCTAssertEqual(total, 1)
    }

    // MARK: VLT-04 trigger 3 — app background

    func test_VLT04_backgroundTrigger_syncsImmediately() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        await scheduler.noteLocalWrite()
        try await waitUntilSleeping(clock)
        let beforeBackground = await work.flushCount
        XCTAssertEqual(beforeBackground, 0)

        await scheduler.appDidEnterBackground()

        let afterBackground = await work.flushCount
        XCTAssertEqual(afterBackground, 1, "backgrounding pushes now — it does not wait out the debounce")
    }

    func test_VLT04_backgroundTrigger_cancelsThePendingDebounce() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        await scheduler.noteLocalWrite()
        try await waitUntilSleeping(clock)
        await scheduler.appDidEnterBackground()

        // Push time well past the old deadline, then let anything still
        // armed run to completion. Order matters: advancing first is what
        // keeps an uncancelled debounce observable as a second push rather
        // than as a drain that never returns.
        clock.advance(by: 600)
        await scheduler.drainDebounceForTests()

        let total = await work.flushCount
        XCTAssertEqual(total, 1, "the debounce was cancelled by the background sync, not left armed")
    }

    func test_VLT04_backgroundWithNothingPending_doesNotPush() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)

        await scheduler.onboardingDidComplete()
        let afterOnboarding = await work.flushCount
        XCTAssertEqual(afterOnboarding, 1)

        await scheduler.appDidEnterBackground()

        let total = await work.flushCount
        XCTAssertEqual(total, 1, "nothing changed since the last confirmed push — no pointless request")
    }

    // MARK: Retry — a failure is never terminal

    func test_VLT04_failedSync_retriesOnNextTrigger() async throws {
        let work = SpyPendingSyncWork(outcomes: [.fail])
        let clock = ManualClock()
        let reporter = RecordingReporter()
        let scheduler = makeScheduler(work: work, clock: clock, reporter: reporter)

        // The post-onboarding push fails. Offline completion is a
        // first-class path (FS-01 acceptance 1), so this is the likely case,
        // not the exotic one.
        await scheduler.onboardingDidComplete()
        let afterFailure = await work.flushCount
        XCTAssertEqual(afterFailure, 1)
        let stillNeedsSync = await scheduler.needsSync
        XCTAssertTrue(stillNeedsSync, "a failed push leaves work pending")
        let lastError = await scheduler.lastError
        XCTAssertEqual(lastError, "spyFailure", "the failure is recorded as a fixed privacy-safe code (G3)")
        XCTAssertEqual(reporter.events.count, 1, "reported once, not swallowed")

        // The very next trigger retries.
        await scheduler.appDidEnterBackground()

        let afterRetry = await work.flushCount
        XCTAssertEqual(afterRetry, 2, "the next trigger retries — a failed sync is never the last word")
        let clearedNeedsSync = await scheduler.needsSync
        XCTAssertFalse(clearedNeedsSync)
        let clearedError = await scheduler.lastError
        XCTAssertNil(clearedError)
    }

    /// A Keychain read can fail while the device is locked
    /// (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `SecureStore.swift`),
    /// which is exactly when a background sync runs. Repeated failures stay
    /// retryable and must never spin.
    func test_VLT04_repeatedFailures_stayRetryableAndDoNotHotLoop() async throws {
        let work = SpyPendingSyncWork(outcomes: [.fail, .fail, .fail])
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        for _ in 0..<3 {
            await scheduler.syncNow()
        }

        let total = await work.flushCount
        XCTAssertEqual(total, 3, "one attempt per trigger — no internal retry storm")
        let needsSync = await scheduler.needsSync
        XCTAssertTrue(needsSync)
    }

    // MARK: Idle

    func test_VLT04_noSyncBeforeAnyChange() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        clock.advance(by: 3_600)
        await scheduler.drainDebounceForTests()

        let count = await work.flushCount
        XCTAssertEqual(count, 0, "an idle scheduler never pushes on its own")
    }

    /// A write that lands *during* a flush is not swallowed by that flush's
    /// success — it stays pending for the next trigger.
    func test_VLT04_writeAfterSuccessfulFlush_isPendingAgain() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()

        await scheduler.noteLocalWrite()
        await scheduler.syncNow()
        let afterFirst = await work.flushCount
        XCTAssertEqual(afterFirst, 1)
        let settled = await scheduler.needsSync
        XCTAssertFalse(settled)

        await scheduler.noteLocalWrite()
        let needsSync = await scheduler.needsSync
        XCTAssertTrue(needsSync, "a write after a confirmed push is pending again")

        // Drain the armed debounce so its parked sleeper is resumed.
        try await waitUntilSleeping(clock)
        clock.advance(by: SyncScheduler.debounceInterval)
        await scheduler.drainDebounceForTests()
    }

    // MARK: Vault → scheduler wiring (plan step 2, MAP-05 layering)

    /// `Vault` announces its writes through a bare closure — it never learns
    /// that a network exists (`CarteOfflineInvariantTests` polices the same
    /// layering from the other side). This is the wiring the composition
    /// root installs, asserted directly.
    func test_VLT04_vaultPersistNotifiesTheScheduler() async throws {
        let work = SpyPendingSyncWork()
        let clock = ManualClock()
        let scheduler = makeScheduler(work: work, clock: clock)
        await scheduler.activate()
        let baseline = await scheduler.writeGenerationForTests

        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        await vault.setOnPersist { [scheduler] in
            Task { await scheduler.noteLocalWrite() }
        }

        let contact = try await vault.addContact(displayName: "A")
        try await vault.setFicheRing(id: contact.id, ring: 2)
        try await waitUntil("both vault writes to reach the scheduler") {
            await scheduler.writeGenerationForTests == baseline + 2
        }
        try await waitUntilSleeping(clock)

        let midBurst = await work.flushCount
        XCTAssertEqual(midBurst, 0, "still inside the debounce window")

        clock.advance(by: SyncScheduler.debounceInterval)
        await scheduler.drainDebounceForTests()

        let total = await work.flushCount
        XCTAssertEqual(total, 1, "a vault write burst reaches the scheduler and coalesces into one push")
    }

    /// `getEncryptedVault()` materialises a blob for the push itself. That
    /// persist must NOT count as a user write, or every sync would re-arm
    /// the debounce it was triggered by.
    func test_VLT04_materialisingTheBlobForAPushIsNotAUserWrite() async throws {
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        let notifications = NotificationCounter()
        await vault.setOnPersist { notifications.increment() }

        _ = try await vault.getEncryptedVault()

        XCTAssertEqual(notifications.value, 0, "reading the blob out for a sync is not a vault change")
    }

    /// `VaultSync` is what the scheduler drives today; the protocol is what
    /// keeps the triggers reusable once ADR-001 stage 4 replaces it (VLT-10).
    func test_VLT04_vaultSyncIsPendingSyncWork() async throws {
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        _ = try await vault.addContact(displayName: "A")
        let api = SpyVaultSyncApi()
        let work: PendingSyncWork = VaultSync(vault: vault, api: api)

        try await work.flushPendingWork()

        let pushes = await api.pushCount
        XCTAssertEqual(pushes, 1)
        XCTAssertEqual(
            work.reportCode(for: VaultSyncError.conflictPersisted),
            "conflictPersisted",
            "the scheduler's G3 code comes from the work itself, so it stays privacy-safe after the swap"
        )
    }
}

private actor SpyVaultSyncApi: VaultSyncApi {
    private(set) var pushCount = 0

    func pushVault(blob: String, version: Int) async throws -> VaultPushResult {
        pushCount += 1
        return .ok(version: version + 1)
    }

    func getVault() async throws -> EncryptedVaultBlob? { nil }
}
