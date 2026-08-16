/// OQ-FCH-1 resolved 2026-08-09 (issue #15): Rôles·contexte and Ressenti
/// vocabularies extracted verbatim from the blueprint's `ROLES`/`VALENCES`
/// consts — pins down the exact shipped lists so a future accidental edit
/// is caught, and confirms État reuses the existing shipped set untouched.
///
/// OQ-FCH-2 resolved 2026-08-09 (issue #16): État is canonical for
/// "en pause" — État now has 4 values, Ressenti 3 (post OQ-FCH-1 swap).
///
/// FCH-09 (2026-08-16): the *displayed* vocabulary is asserted here exactly
/// as before — this change must be invisible to the user. The stored
/// identifiers are asserted in `ClassificationValuesTests`.
import XCTest

@testable import SwabCore

final class FicheVocabularyTests: XCTestCase {
    func test_OQFCH1_rolesMatchBlueprintVocabulary() {
        XCTAssertEqual(
            FicheVocabulary.roleLabels,
            ["famille", "partenaire", "collègue", "promo", "communauté", "voisin"]
        )
        XCTAssertEqual(FicheVocabulary.roles.count, 6)
    }

    func test_OQFCH2_etatIncludesEnPauseAsFourthValue() {
        XCTAssertEqual(
            FicheVocabulary.etatLabels,
            [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway), Fr.t(.etatPaused)]
        )
        XCTAssertEqual(FicheVocabulary.etats.count, 4)
        XCTAssertEqual(Fr.t(.etatPaused), "en pause")
    }

    func test_OQFCH1_ressentiMatchesBlueprintVocabulary() {
        XCTAssertEqual(FicheVocabulary.ressentiLabels, ["positive", "ambivalente", "négative"])
        XCTAssertEqual(FicheVocabulary.ressentis.count, 3)
        XCTAssertFalse(FicheVocabulary.ressentiLabels.contains("en pause"))
        XCTAssertFalse(FicheVocabulary.ressentiLabels.contains("léger"))
        XCTAssertFalse(FicheVocabulary.ressentiLabels.contains("précieux"))
    }
}
