/// ONB-08: resumable onboarding. Step persists across a simulated process
/// restart (fresh `OnboardingStateStore` instance over the same storage) and
/// stays `.phone` until OTP verification succeeds (that transition happens
/// in the OTP screen's view model, not here — this test locks the state
/// machine's own contract: only an explicit `setStep` call advances it).
import Foundation
import XCTest

@testable import SwabCore

final class OnboardingStateTests: XCTestCase {
    func test_ONB08_defaultsToWelcomeWithNoPersistedStep() async {
        let store = OnboardingStateStore(kv: InMemoryKeyValueStore())
        let step = await store.getStep()
        XCTAssertEqual(step, .welcome)
    }

    func test_ONB08_stepPersistsAcrossSimulatedRestart() async {
        let kv = InMemoryKeyValueStore()
        let store = OnboardingStateStore(kv: kv)
        await store.setStep(.contacts)

        // Simulate process restart: a fresh store instance over the same kv.
        let reopened = OnboardingStateStore(kv: kv)
        let step = await reopened.getStep()
        XCTAssertEqual(step, .contacts)
    }

    func test_ONB08_stepStaysPhoneUntilExplicitlyAdvanced() async {
        let store = OnboardingStateStore(kv: InMemoryKeyValueStore())
        await store.setStep(.phone)

        // A restart mid-OTP (pending hash is memory-only, see PendingSignup)
        // must resume at `.phone`, never silently skip ahead.
        let step = await store.getStep()
        XCTAssertEqual(step, .phone)
    }

    func test_ONB08_allStepsRoundTripThroughRawValue() async {
        for step in OnboardingStep.allCases {
            let store = OnboardingStateStore(kv: InMemoryKeyValueStore())
            await store.setStep(step)
            let read = await store.getStep()
            XCTAssertEqual(read, step)
        }
    }

    func test_ONB08_corruptedPersistedValueFallsBackToWelcome() async {
        let kv = InMemoryKeyValueStore()
        await kv.set("onboarding.step.v1", value: "not-a-real-step")
        let store = OnboardingStateStore(kv: kv)
        let step = await store.getStep()
        XCTAssertEqual(step, .welcome)
    }

    func test_routeForStep_mapsCompleteToRoot() {
        XCTAssertEqual(route(for: .complete), "/")
        XCTAssertEqual(route(for: .welcome), "/onboarding/welcome")
        XCTAssertEqual(route(for: .phone), "/onboarding/phone")
        XCTAssertEqual(route(for: .contacts), "/onboarding/contacts")
        XCTAssertEqual(route(for: .calibrate), "/onboarding/calibrate")
        XCTAssertEqual(route(for: .done), "/onboarding/done")
    }
}

final class PendingSignupTests: XCTestCase {
    func test_pendingPhoneHash_startsNilAndClearsCorrectly() {
        let pending = PendingSignup()
        XCTAssertNil(pending.pendingPhoneHash)

        pending.setPendingPhoneHash("hash123")
        pending.setDevCode("000000")
        XCTAssertEqual(pending.pendingPhoneHash, "hash123")
        XCTAssertEqual(pending.devCode, "000000")

        pending.clear()
        XCTAssertNil(pending.pendingPhoneHash)
        XCTAssertNil(pending.devCode)
    }
}
