/// ONB-08 — resumable onboarding. The current step is persisted locally
/// (plain: a step name is not classification data). Killing the app mid-flow
/// resumes at the same step via the root gate.
///
/// The step stays `.phone` until OTP verification succeeds — the pending
/// phone hash is memory-only (`PendingSignup`), so a restart during OTP
/// re-asks the number.
import Foundation

public enum OnboardingStep: String, CaseIterable, Sendable {
    case welcome
    case phone
    case contacts
    case calibrate
    case done
    case complete
}

public actor OnboardingStateStore {
    private static let stepKey = "onboarding.step.v1"

    private let kv: KeyValueStore
    private var cached: OnboardingStep?

    public init(kv: KeyValueStore) {
        self.kv = kv
    }

    public func getStep() async -> OnboardingStep {
        if let cached {
            return cached
        }
        let raw = await kv.get(Self.stepKey)
        let step = raw.flatMap { OnboardingStep(rawValue: $0) } ?? .welcome
        cached = step
        return step
    }

    public func setStep(_ step: OnboardingStep) async {
        cached = step
        await kv.set(Self.stepKey, value: step.rawValue)
    }

    /// Test seam: drops in-memory state, simulating a process restart.
    public func resetForTests() {
        cached = nil
    }
}

public func route(for step: OnboardingStep) -> String {
    switch step {
    case .welcome: return "/onboarding/welcome"
    case .phone: return "/onboarding/phone"
    case .contacts: return "/onboarding/contacts"
    case .calibrate: return "/onboarding/calibrate"
    case .done: return "/onboarding/done"
    case .complete: return "/"
    }
}
