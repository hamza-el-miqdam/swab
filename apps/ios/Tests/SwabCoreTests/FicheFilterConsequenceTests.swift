/// FCH-06 — filter-consequence display text, informational only.
///
/// OQ-FCH-2 resolved 2026-08-09 (issue #16): État is canonical for
/// "en pause" — ressenti is no longer consulted.
import XCTest

@testable import SwabCore

final class FicheFilterConsequenceTests: XCTestCase {
    func test_FCH06_etatEnPause_showsConsequenceText() {
        let text = FicheFilterConsequence.text(etat: Fr.t(.etatPaused), ressenti: nil)
        XCTAssertEqual(text, "en pause → exclu par défaut à l’envoi")
    }

    /// OQ-FCH-2 resolved: "en pause" on the ressenti axis is no longer
    /// meaningful (ressenti has no such value) and must NOT surface the
    /// consequence text — only état is canonical now.
    func test_FCH06_ressentiEnPause_noLongerSurfacesConsequenceText() {
        let text = FicheFilterConsequence.text(etat: nil, ressenti: "en pause")
        XCTAssertNil(text)
    }

    func test_FCH06_neitherAxisPaused_noConsequenceText() {
        XCTAssertNil(FicheFilterConsequence.text(etat: Fr.t(.etatAvailable), ressenti: Fr.t(.ressentiPositive)))
    }

    func test_FCH06_bothNil_noConsequenceText() {
        XCTAssertNil(FicheFilterConsequence.text(etat: nil, ressenti: nil))
    }
}
