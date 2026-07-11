/// Pending signup state — memory only, on purpose. The raw phone number is
/// hashed before it ever leaves the input handler; only the hash is held
/// here between the phone and OTP steps. If the app dies in between,
/// onboarding resumes at the phone step (`OnboardingStateStore`).
import Foundation

public final class PendingSignup: @unchecked Sendable {
    private let lock = NSLock()
    private var _pendingPhoneHash: String?
    private var _devCode: String?

    public init() {}

    public var pendingPhoneHash: String? {
        lock.lock()
        defer { lock.unlock() }
        return _pendingPhoneHash
    }

    public func setPendingPhoneHash(_ hash: String) {
        lock.lock()
        _pendingPhoneHash = hash
        lock.unlock()
    }

    public var devCode: String? {
        lock.lock()
        defer { lock.unlock() }
        return _devCode
    }

    /// POC only: OTP code echoed by the API in non-production (OQ-IDT-1).
    public func setDevCode(_ code: String?) {
        lock.lock()
        _devCode = code
        lock.unlock()
    }

    public func clear() {
        lock.lock()
        _pendingPhoneHash = nil
        _devCode = nil
        lock.unlock()
    }
}
