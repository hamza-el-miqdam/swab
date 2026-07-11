/// FCH-06 — filter-consequence display text, informational only.
import XCTest

@testable import SwabCore

final class FicheFilterConsequenceTests: XCTestCase {
    func test_FCH06_etatEnPause_showsConsequenceText() {
        let text = FicheFilterConsequence.text(etat: Fr.t(.ressentiPaused), ressenti: nil)
        XCTAssertEqual(text, "en pause → exclu par défaut à l’envoi")
    }

    /// Divergence flag: the shipped vocabulary puts "en pause" under
    /// ressenti, not état — the consequence text must still surface there.
    func test_FCH06_ressentiEnPause_showsConsequenceText() {
        let text = FicheFilterConsequence.text(etat: nil, ressenti: Fr.t(.ressentiPaused))
        XCTAssertEqual(text, Fr.t(.ficheEtatPausedConsequence))
    }

    func test_FCH06_neitherAxisPaused_noConsequenceText() {
        XCTAssertNil(FicheFilterConsequence.text(etat: Fr.t(.etatAvailable), ressenti: Fr.t(.ressentiLight)))
    }

    func test_FCH06_bothNil_noConsequenceText() {
        XCTAssertNil(FicheFilterConsequence.text(etat: nil, ressenti: nil))
    }
}
