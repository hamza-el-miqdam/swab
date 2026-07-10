/// OQ-FCH-1 placeholder taxonomy — pins down the exact shipped lists so a
/// future accidental edit is caught, and confirms État/Ressenti reuse the
/// existing shipped 3-value sets rather than a newly invented one.
import XCTest

@testable import SwabCore

final class FicheVocabularyTests: XCTestCase {
    func test_OQFCH1_rolesPlaceholderTaxonomy() {
        XCTAssertEqual(FicheVocabulary.roles, ["Famille", "Amitié", "Travail", "Voisinage", "Autre"])
    }

    func test_etatReusesShippedThreeValueSet() {
        XCTAssertEqual(FicheVocabulary.etats, [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway)])
        XCTAssertEqual(FicheVocabulary.etats.count, 3)
    }

    func test_ressentiReusesShippedThreeValueSet() {
        XCTAssertEqual(FicheVocabulary.ressentis, [Fr.t(.ressentiLight), Fr.t(.ressentiPrecious), Fr.t(.ressentiPaused)])
        XCTAssertEqual(FicheVocabulary.ressentis.count, 3)
    }
}
