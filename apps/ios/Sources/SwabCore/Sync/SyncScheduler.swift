/// FS-07 VLT-04 — *when* pending local work is pushed, decoupled from *what*
/// that work is.
///
/// VLT-04 names three triggers: post-onboarding, app background, and after
/// any write burst (debounced ≥ 30 s). Before this type existed the iOS app
/// pushed from exactly one place — `DoneViewModel.finish()` — so every fiche
/// edit made after onboarding stayed on the device forever, and a single
/// failed onboarding push was never retried. Offline onboarding completion
/// is a first-class path (FS-01 acceptance 1), which made that one push the
/// one most likely to fail.
///
/// **Deliberately not coupled to `VaultSync`.** ADR-001 stage 4 replaces the
/// vault blob with a local cache plus a durable offline outbox (VLT-10). The
/// *triggers* survive that swap; the *work* does not. So the scheduler drives
/// a `PendingSyncWork` — `VaultSync` conforms today, the outbox conforms
/// tomorrow — and nothing in this file mentions blobs, versions or HTTP.
import Foundation

/// One unit of "there is local state the server has not confirmed".
///
/// Throwing from `flushPendingWork()` means *still pending*: the scheduler
/// records the failure, keeps `needsSync` true, and retries on the next
/// trigger. It never retries in a loop of its own — a device that is offline
/// or locked must not be hammered.
public protocol PendingSyncWork: Sendable {
    func flushPendingWork() async throws

    /// G3: a fixed, privacy-safe code for a `flushPendingWork()` failure.
    /// The scheduler never touches `Error.localizedDescription` — a decode
    /// failure's context string can embed decoded payload fragments. The
    /// work owns the mapping because the work owns the error vocabulary.
    func reportCode(for error: Error) -> String
}

extension PendingSyncWork {
    public func reportCode(for error: Error) -> String { "syncFailed" }
}

public actor SyncScheduler {
    /// VLT-04: "debounced ≥ 30 s".
    public static let debounceInterval: TimeInterval = 30

    public typealias Clock = @Sendable () -> Date
    public typealias Sleeper = @Sendable (TimeInterval) async throws -> Void

    /// Default sleeper. Injected rather than called directly so tests drive a
    /// deterministic clock instead of waiting out a real 30-second window.
    public static let systemSleep: Sleeper = { interval in
        guard interval > 0 else { return }
        try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
    }

    private let work: PendingSyncWork
    private let reporter: ErrorReporter
    private let now: Clock
    private let sleep: Sleeper

    /// ONB-05 gate. Every trigger is inert until `activate()`: nothing may
    /// leave the device while onboarding's local-only window is open.
    private var isActive = false
    private var lastWriteAt: Date?
    private var debounceTask: Task<Void, Never>?
    private var isFlushing = false

    /// Bumped by `activate()` and by every `noteLocalWrite()`; a flush
    /// records the generation it *attempted*, so a write that lands while a
    /// flush is in flight is not swallowed by that flush's success.
    private var writeGeneration = 0
    private var flushedGeneration = 0
    private var lastFlushFailed = false

    /// Fixed privacy-safe code of the last failure (G3), or nil after a
    /// confirmed push. Never a raw error string.
    public private(set) var lastError: String?

    /// True while the server has not confirmed the current local state.
    public var needsSync: Bool {
        writeGeneration != flushedGeneration || lastFlushFailed
    }

    public init(
        work: PendingSyncWork,
        reporter: ErrorReporter = NoopErrorReporter(),
        now: @escaping Clock = { Date() },
        sleep: @escaping Sleeper = SyncScheduler.systemSleep
    ) {
        self.work = work
        self.reporter = reporter
        self.now = now
        self.sleep = sleep
    }

    // MARK: - Triggers

    /// ONB-05's window has closed — arm the triggers.
    ///
    /// Marks work pending without pushing: whatever was written before this
    /// point (onboarding's contacts and calibration, or a previous session
    /// that died before its push landed) has never been confirmed by the
    /// server, and nothing durable records it yet — the outbox is VLT-10 /
    /// ADR-001 stage 4. The cost of being wrong is one redundant push per
    /// app session; the cost of the opposite is silent data loss.
    public func activate() {
        guard !isActive else { return }
        isActive = true
        writeGeneration += 1
    }

    /// VLT-04 trigger 1 — post-onboarding.
    public func onboardingDidComplete() async {
        activate()
        await syncNow()
    }

    /// VLT-04 trigger 2 — a local write. Debounced: a burst of edits
    /// coalesces into one push, `debounceInterval` after the last of them.
    public func noteLocalWrite() {
        guard isActive else { return }
        writeGeneration += 1
        lastWriteAt = now()
        startDebounceIfNeeded()
    }

    /// VLT-04 trigger 3 — the app went to the background. Cancels the
    /// pending debounce (waiting it out in the background is exactly what
    /// there is no time for) and pushes immediately, if anything is pending.
    public func appDidEnterBackground() async {
        guard isActive else { return }
        cancelDebounce()
        guard needsSync else { return }
        await syncNow()
    }

    /// One flush attempt. Never throws: a failed sync is a normal state, not
    /// an error the caller has to handle.
    public func syncNow() async {
        guard isActive else { return }
        // Actors are reentrant: a background trigger can land while a
        // debounce-fired push is mid-flight. Skip rather than push twice —
        // `attempted` below means the in-flight push cannot claim writes it
        // did not carry, so anything newer stays pending for the next trigger.
        guard !isFlushing else { return }
        isFlushing = true
        let attempted = writeGeneration
        do {
            try await work.flushPendingWork()
            flushedGeneration = attempted
            lastFlushFailed = false
            lastError = nil
        } catch {
            // Retryable by construction. The Keychain that holds the session
            // token is `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
            // (`Identity/SecureStore.swift`), so a background sync running
            // after the device locks legitimately fails to read it; a
            // backgrounded push can also be cut short by suspension. Neither
            // is fatal — `needsSync` stays true and the next trigger retries.
            lastFlushFailed = true
            let code = work.reportCode(for: error)
            lastError = code
            // `domain` stays "vault.sync": it is the established Console.app
            // category for this failure (see `OSLogErrorReporter`), inherited
            // from `DoneViewModel`. A stable log category, not a coupling —
            // nothing here knows what a vault is.
            reporter.report(
                ReportedError(domain: "vault.sync", operation: "sync", errorDescription: code)
            )
        }
        isFlushing = false
    }

    // MARK: - Debounce

    /// At most one debounce task exists at a time. A new write does not spawn
    /// a second one — it moves `lastWriteAt`, and the running task re-reads
    /// the deadline on every wake. (Plan gotcha: "cancelled/restarted per
    /// change, not accumulated, or rapid edits leak tasks".)
    private var isDebouncing: Bool {
        guard let debounceTask else { return false }
        return !debounceTask.isCancelled
    }

    private func startDebounceIfNeeded() {
        guard !isDebouncing else { return }
        let sleeper = sleep
        let clock = now
        debounceTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let remaining = await self?.remainingDebounce(at: clock()) else { return }
                if remaining <= 0 { break }
                do {
                    try await sleeper(remaining)
                } catch {
                    return  // cancelled
                }
            }
            guard !Task.isCancelled else { return }
            await self?.debounceDidFire()
        }
    }

    private func remainingDebounce(at instant: Date) -> TimeInterval {
        guard let lastWriteAt else { return 0 }
        return lastWriteAt.addingTimeInterval(Self.debounceInterval).timeIntervalSince(instant)
    }

    private func debounceDidFire() async {
        debounceTask = nil
        await syncNow()
    }

    private func cancelDebounce() {
        debounceTask?.cancel()
    }

    // MARK: - Test seams (`@testable` only — not part of the public surface)

    /// Awaits the in-flight debounce task, including the sync it fires.
    func drainDebounceForTests() async {
        for _ in 0..<8 {
            guard let task = debounceTask else { return }
            await task.value
            if debounceTask == task {
                debounceTask = nil
                return
            }
        }
    }

    var debounceTaskCountForTests: Int { debounceTask == nil ? 0 : 1 }

    var writeGenerationForTests: Int { writeGeneration }
}
