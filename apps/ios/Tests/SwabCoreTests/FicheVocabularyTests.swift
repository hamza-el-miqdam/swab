/// OQ-FCH-1 placeholder taxonomy — pins down the exact shipped lists so a
/// future accidental edit is caught, and confirms État/Ressenti reuse the
/// existing shipped sets rather than a newly invented one.
///
/// OQ-FCH-2 resolved 2026-08-09 (issue #16): État is canonical for
/// "en pause" — État now has 4 values, Ressenti 2.
import XCTest

@testable import SwabCore

final class FicheVocabularyTests: XCTestCase {
    func test_OQFCH1_rolesPlaceholderTaxonomy() {
        XCTAssertEqual(FicheVocabulary.roles, ["Famille", "Amitié", "Travail", "Voisinage", "Autre"])
    }

    func test_OQFCH2_etatIncludesEnPauseAsFourthValue() {
        XCTAssertEqual(
            FicheVocabulary.etats,
            [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway), Fr.t(.etatPaused)]
        )
        XCTAssertEqual(FicheVocabulary.etats.count, 4)
        XCTAssertEqual(Fr.t(.etatPaused), "en pause")
    }

    func test_OQFCH2_ressentiNoLongerIncludesEnPause() {
        XCTAssertEqual(FicheVocabulary.ressentis, [Fr.t(.ressentiLight), Fr.t(.ressentiPrecious)])
        XCTAssertEqual(FicheVocabulary.ressentis.count, 2)
        XCTAssertFalse(FicheVocabulary.ressentis.contains("en pause"))
    }
}
