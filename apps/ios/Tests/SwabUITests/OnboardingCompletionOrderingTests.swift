/// ONB-08 — onboarding is resumable: "killing the app mid-flow resumes at
/// the same step from local state" (`docs/specs/FS-01-onboarding.md:35`).
///
/// `DoneViewModel.finish()` both completes onboarding and fires the first
/// push. If the push runs *before* `.complete` is persisted, a user who
/// force-quits while it is in flight relaunches onto the completion screen
/// they already passed. `URLSession.shared`'s default request timeout is
/// 60 s, so that window is long — and while issue #127 stands (the first
/// push can never succeed) it is the normal path for every new account,
/// not an edge case.
///
/// Mirrors Android's `OnboardingCompletionOrderingTest.
/// test_ONB08_completingOnboarding_persistsCompleteBeforeAnyNetworkCall`
/// (SUG-AND-001 / PR #126) so the two platforms cannot drift apart on it.
import Foundation
import XCTest

@testable import SwabUI
import SwabCore

/// Reads the onboarding step straight out of the key-value store at the
/// moment the push starts — the persisted value, not the actor's in-memory
/// cache, since ONB-08 is about surviving a process kill.
private actor StepObservingWork: PendingSyncWork {
    private let kv: KeyValueStore
    private(set) var persistedStepAtPushTime: String?
    private(set) var flushCount = 0

    init(kv: KeyValueStore) {
        self.kv = kv
    }

    func flushPendingWork() async throws {
        flushCount += 1
        persistedStepAtPushTime = await kv.get("onboarding.step.v1")
    }
}

@MainActor
final class OnboardingCompletionOrderingTests: XCTestCase {
    func test_ONB08_completingOnboarding_persistsCompleteBeforeAnyNetworkCall() async throws {
        let kv = InMemoryKeyValueStore()
        let onboarding = OnboardingStateStore(kv: kv)
        await onboarding.setStep(.done)

        let work = StepObservingWork(kv: kv)
        let viewModel = DoneViewModel(
            onboarding: onboarding,
            syncScheduler: SyncScheduler(work: work)
        )

        await viewModel.finish()

        let flushes = await work.flushCount
        XCTAssertEqual(flushes, 1, "sanity: the post-onboarding push did fire")
        let stepAtPushTime = await work.persistedStepAtPushTime
        XCTAssertEqual(
            stepAtPushTime,
            OnboardingStep.complete.rawValue,
            "ONB-08: `.complete` must already be on disk when the first push starts — "
                + "a force-quit during that push must not drop the user back onto the "
                + "completion screen"
        )
    }

    /// The push must still happen; persisting first must not turn the
    /// post-onboarding trigger into a no-op.
    func test_ONB08_persistingFirst_stillFiresThePostOnboardingPush() async throws {
        let kv = InMemoryKeyValueStore()
        let onboarding = OnboardingStateStore(kv: kv)
        let work = StepObservingWork(kv: kv)

        await DoneViewModel(
            onboarding: onboarding,
            syncScheduler: SyncScheduler(work: work)
        ).finish()

        let flushes = await work.flushCount
        XCTAssertEqual(flushes, 1)
        let step = await onboarding.getStep()
        XCTAssertEqual(step, .complete)
    }
}
