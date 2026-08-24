/// FS-07 VLT-10 — *when* pending local work is replayed, decoupled from
/// *what* that work is.
///
/// **What the spec actually requires.** VLT-10: "Offline writes queue in a
/// durable local outbox and replay **in order** on reconnect." FS-01
/// acceptance 1: placements made in airplane mode "sync to the server when
/// connectivity returns (VLT-04), with no data loss". Before this type
/// existed the iOS app pushed from exactly one place —
/// `DoneViewModel.finish()` — so every fiche edit made after onboarding
/// stayed on the device forever, and a single failed onboarding push was
/// never retried. Offline onboarding completion is a first-class path, which
/// made that one push the one most likely to fail.
///
/// **The specific triggers below are engineering choices, not requirements.**
/// FS-07's VLT-04 named "app background, post-onboarding, after any write
/// burst (debounced ≥30s)" until commit `ab3f241` (2026-08-16, ADR-001)
/// replaced it with the local-cache wording it carries now. Nothing in the
/// current spec names a trigger or an interval. Post-onboarding, background,
/// and a 30 s debounce are this client's approximation of "on reconnect"
/// while it has no reachability callback — change them freely if a better
/// approximation appears; only the VLT-10 guarantee is binding.
///
/// **This is not the durable outbox VLT-10 asks for.** `needsSync` lives in
/// memory, so a session killed between a failed push and the next trigger
/// loses the retry. Durability arrives with ADR-001 stage 4.
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
    /// Debounce window. An engineering choice, not a spec constant — see the
    /// header: the current FS-07 names no interval.
    public static let debounceInterval: TimeInterval = 30

    public typealias Clock = @Sendable () -> Date
    public typealias Sleeper = @Sendable (TimeInterval) async throws -> Void

    /// Default sleeper. Injected rather than called directly so tests drive a
    /// deterministic clock instead of waiting out a real 30-second window.
    public static let systemSleep: Sleeper = { interval in
        guard interval > 0 else { return }
        try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
    }

    /// Backoff for a push that keeps failing the same way.
    ///
    /// One free retry (the first failure is very often transient — a tunnel,
    /// a locked Keychain), then doubling from a minute up to an hour. Without
    /// this a permanently-failing push retries on *every* trigger: while
    /// issue #127 stands, the first push of every new account can never
    /// succeed, so an evening of five edits and ten backgroundings would be
    /// ~45 doomed requests. Failures are still reported (G3) — they are just
    /// not re-attempted on a hair trigger.
    public static let backoffBase: TimeInterval = 60
    public static let backoffCap: TimeInterval = 3600

    static func backoffDelay(afterConsecutiveFailures count: Int) -> TimeInterval {
        guard count >= 2 else { return 0 }
        let doublings = min(count - 2, 16)
        return min(backoffBase * pow(2, Double(doublings)), backoffCap)
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

    /// A trigger that arrived while a flush was already running. The
    /// in-flight flush re-runs for it rather than dropping it (see
    /// `syncNow()`).
    private var flushRequestedDuringFlush = false

    /// Consecutive failures with the *same* report code, and the instant
    /// before which no further attempt is made. A different code resets the
    /// count — a changed failure is new information, not more of the same.
    private var consecutiveIdenticalFailures = 0
    private var retryNotBefore: Date?

    /// Fixed privacy-safe code of the last failure (G3), or nil after a
    /// confirmed push. Never a raw error string.
    public private(set) var lastError: String?

    /// True while the server has not confirmed the current local state.
    public var needsSync: Bool {
        writeGeneration != flushedGeneration || lastFlushFailed
    }

    /// True while a repeatedly-failing push is cooling off.
    public var isBackingOff: Bool {
        guard let retryNotBefore else { return false }
        return now() < retryNotBefore
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

    /// Trigger 1 — post-onboarding.
    public func onboardingDidComplete() async {
        activate()
        await syncNow()
    }

    /// Trigger 2 — a local write. Debounced: a burst of edits
    /// coalesces into one push, `debounceInterval` after the last of them.
    public func noteLocalWrite() {
        guard isActive else { return }
        writeGeneration += 1
        lastWriteAt = now()
        startDebounceIfNeeded()
    }

    /// Trigger 3 — the app went to the background. Cancels the
    /// pending debounce (waiting it out in the background is exactly what
    /// there is no time for) and pushes immediately, if anything is pending.
    public func appDidEnterBackground() async {
        guard isActive else { return }
        cancelDebounce()
        guard needsSync else { return }
        await syncNow()
    }

    /// Flush whatever is pending. Never throws: a failed sync is a normal
    /// state, not an error the caller has to handle.
    public func syncNow() async {
        guard isActive else { return }
        guard !isBackingOff else { return }
        // Actors are reentrant: a trigger can land while a flush is already
        // in flight. Record it rather than dropping it — the running flush
        // re-runs below, so a write that arrives mid-push is never stranded
        // with nothing scheduled to carry it.
        guard !isFlushing else {
            flushRequestedDuringFlush = true
            return
        }
        isFlushing = true
        repeat {
            flushRequestedDuringFlush = false
            await performFlush()
        } while flushRequestedDuringFlush && needsSync && !isBackingOff
        isFlushing = false
    }

    private func performFlush() async {
        // Captured BEFORE the await: a write landing mid-flush bumps
        // `writeGeneration` past `attempted`, so this flush cannot claim
        // work it did not carry.
        let attempted = writeGeneration
        do {
            try await work.flushPendingWork()
            flushedGeneration = attempted
            lastFlushFailed = false
            lastError = nil
            consecutiveIdenticalFailures = 0
            retryNotBefore = nil
        } catch {
            // Retryable by construction. The Keychain that holds the session
            // token is `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
            // (`Identity/SecureStore.swift`), so a background sync running
            // after the device locks legitimately fails to read it; a
            // backgrounded push can also be cut short by suspension. Neither
            // is fatal — `needsSync` stays true and a later trigger retries.
            lastFlushFailed = true
            let code = work.reportCode(for: error)
            consecutiveIdenticalFailures = (code == lastError) ? consecutiveIdenticalFailures + 1 : 1
            lastError = code
            let delay = Self.backoffDelay(afterConsecutiveFailures: consecutiveIdenticalFailures)
            retryNotBefore = delay > 0 ? now().addingTimeInterval(delay) : nil
            // `domain` stays "vault.sync": it is the established Console.app
            // category for this failure (see `OSLogErrorReporter`), inherited
            // from `DoneViewModel`. A stable log category, not a coupling —
            // nothing here knows what a vault is.
            reporter.report(
                ReportedError(domain: "vault.sync", operation: "sync", errorDescription: code)
            )
        }
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
        // Same guard as the background trigger: if a push already carried
        // these writes (a backgrounding beat the debounce), there is nothing
        // to send.
        guard needsSync else { return }
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
