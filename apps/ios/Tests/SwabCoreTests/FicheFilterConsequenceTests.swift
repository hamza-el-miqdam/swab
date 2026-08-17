/// FCH-06 — filter-consequence display text, informational only.
///
/// OQ-FCH-2 resolved 2026-08-09 (issue #16): État is canonical for
/// "en pause" — ressenti is no longer consulted.
import XCTest

@testable import SwabCore

final class FicheFilterConsequenceTests: XCTestCase {
    func test_FCH06_etatEnPause_showsConsequenceText() {
        let text = FicheFilterConsequence.text(etat: .paused, ressenti: nil)
        XCTAssertEqual(text, "en pause → exclu par défaut à l’envoi")
    }

    /// OQ-FCH-2 resolved: "en pause" on the ressenti axis is no longer
    /// meaningful and must NOT surface the consequence text — only état is
    /// canonical. Since FCH-09 the Ressenti type has no such case at all, so
    /// the axis confusion is now unrepresentable; what remains to pin is that
    /// no ressenti value triggers the état consequence.
    func test_FCH06_noRessentiValueSurfacesTheEtatConsequenceText() {
        for ressenti in Ressenti.allCases {
            XCTAssertNil(FicheFilterConsequence.text(etat: nil, ressenti: ressenti))
        }
    }

    /// FCH-09 regression: the consequence used to be `etat == Fr.t(.etatPaused)`,
    /// so rewording the copy silently stopped surfacing it — a filter going
    /// quiet, which « rien ne disparaît en silence » forbids. Keyed on the
    /// identifier, the text survives any copy change.
    func test_FCH09_consequenceKeysOnIdentifierNotDisplayCopy() {
        XCTAssertEqual(Etat.paused.rawValue, "paused")
        XCTAssertNotNil(FicheFilterConsequence.text(etat: Etat(rawValue: "paused"), ressenti: nil))
    }

    func test_FCH06_neitherAxisPaused_noConsequenceText() {
        XCTAssertNil(FicheFilterConsequence.text(etat: .available, ressenti: .positive))
    }

    func test_FCH06_bothNil_noConsequenceText() {
        XCTAssertNil(FicheFilterConsequence.text(etat: nil, ressenti: nil))
    }
}
