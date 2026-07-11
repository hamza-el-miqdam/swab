/// FCH-08 — pending (not-yet-joined) contacts still get a fiche; only
/// envie eligibility is inactive.
import XCTest

@testable import SwabCore

final class FicheEligibilityTests: XCTestCase {
    func test_FCH08_pendingContact_targetIdNil_envieInactive() {
        XCTAssertFalse(FicheEligibility.isEnvieActive(targetId: nil))
    }

    func test_FCH08_joinedContact_targetIdSet_envieActive() {
        XCTAssertTrue(FicheEligibility.isEnvieActive(targetId: "user-123"))
    }
}
