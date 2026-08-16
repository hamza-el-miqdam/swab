/// FCH-09 — stored classification values are stable identifiers, decoupled
/// from the French display copy (ADR-001 stage 0b).
///
/// The identifier lists below are the CROSS-PLATFORM CONTRACT, copied from
/// FS-03 § *Stored value vocabulary*. `ClassificationValuesTest.kt` on
/// Android asserts the same literals. If you change one, the other fails —
/// which is the point: a divergence must break a build, not become data that
/// only one client can read.
import XCTest

@testable import SwabCore

final class ClassificationValuesTests: XCTestCase {
    // MARK: - The frozen contract

    func test_FCH09_etatIdentifiersMatchTheSpecTable() {
        XCTAssertEqual(Etat.identifiers, ["available", "busy", "away", "paused"])
    }

    func test_FCH09_ressentiIdentifiersMatchTheSpecTable() {
        XCTAssertEqual(Ressenti.identifiers, ["positive", "ambivalent", "negative"])
    }

    func test_FCH09_roleIdentifiersMatchTheSpecTable() {
        XCTAssertEqual(
            RoleContexte.identifiers,
            ["family", "partner", "colleague", "cohort", "community", "neighbor"]
        )
    }

    /// The whole point of the requirement: no identifier is ever also copy.
    func test_FCH09_noIdentifierIsAlsoItsOwnDisplayLabel_exceptWhereFrenchAndEnglishCoincide() {
        // « positive » is spelled identically in both languages; everything
        // else must differ, or the decoupling is only nominal.
        let coincidental = ["positive"]
        for value in Etat.allCases {
            XCTAssertNotEqual(value.rawValue, value.label, "Etat.\(value)")
        }
        for value in Ressenti.allCases where !coincidental.contains(value.rawValue) {
            XCTAssertNotEqual(value.rawValue, value.label, "Ressenti.\(value)")
        }
        for value in RoleContexte.allCases {
            XCTAssertNotEqual(value.rawValue, value.label, "RoleContexte.\(value)")
        }
    }

    // MARK: - Dual read (the migration contract)

    func test_FCH09_legacyFrenchEtatString_parsesToIdentifier() {
        XCTAssertEqual(Etat.parse(stored: "disponible"), .available)
        XCTAssertEqual(Etat.parse(stored: "occupé"), .busy)
        XCTAssertEqual(Etat.parse(stored: "ailleurs"), .away)
        XCTAssertEqual(Etat.parse(stored: "en pause"), .paused)
    }

    func test_FCH09_legacyFrenchRessentiAndRoleStrings_parseToIdentifiers() {
        XCTAssertEqual(Ressenti.parse(stored: "ambivalente"), .ambivalent)
        XCTAssertEqual(Ressenti.parse(stored: "négative"), .negative)
        XCTAssertEqual(RoleContexte.parse(stored: "collègue"), .colleague)
        XCTAssertEqual(RoleContexte.parse(stored: "promo"), .cohort)
        XCTAssertEqual(RoleContexte.parse(stored: "communauté"), .community)
        XCTAssertEqual(RoleContexte.parse(stored: "voisin"), .neighbor)
    }

    /// A pre-FCH-09 blob decodes to identifiers and re-encodes as identifiers
    /// — one silent, idempotent migration on the next write.
    func test_FCH09_legacyBlob_decodesToIdentifiers_andReEncodesAsIdentifiers() throws {
        let legacy = """
            {"id":"c1","displayName":"Leïla","ring":2,"roles":["famille","collègue"],\
            "etat":"occupé","ressenti":"négative","history":[]}
            """
        let decoded = try JSONDecoder().decode(VaultContact.self, from: Data(legacy.utf8))

        XCTAssertEqual(decoded.etat, "busy")
        XCTAssertEqual(decoded.ressenti, "negative")
        XCTAssertEqual(decoded.roles, ["family", "colleague"])
        XCTAssertEqual(decoded.etatValue, .busy)

        let reEncoded = String(decoding: try JSONEncoder().encode(decoded), as: UTF8.self)
        XCTAssertTrue(reEncoded.contains("\"busy\""))
        XCTAssertFalse(reEncoded.contains("occupé"))
        XCTAssertFalse(reEncoded.contains("collègue"))
    }

    /// FCH-09's no-data-loss clause. `douceur` and `confidente` are real
    /// pre-OQ-FCH-1 values still present in `vault-test-vectors.json`; they
    /// map to nothing in today's vocabulary and must survive untouched
    /// rather than being dropped or guessed at.
    func test_FCH09_unknownToken_isPreservedVerbatimAndRendersUnset() throws {
        let exotic = """
            {"id":"c2","displayName":"X","roles":["confidente"],"ressenti":"douceur",\
            "etat":"not-a-real-etat","history":[]}
            """
        let decoded = try JSONDecoder().decode(VaultContact.self, from: Data(exotic.utf8))

        XCTAssertEqual(decoded.etat, "not-a-real-etat", "kept byte-for-byte")
        XCTAssertEqual(decoded.ressenti, "douceur")
        XCTAssertEqual(decoded.roles, ["confidente"])

        XCTAssertNil(decoded.etatValue, "unmappable → renders unset, never a crash")
        XCTAssertNil(decoded.ressentiValue)
        XCTAssertEqual(decoded.roleValues, [])

        let reEncoded = String(decoding: try JSONEncoder().encode(decoded), as: UTF8.self)
        XCTAssertTrue(reEncoded.contains("douceur"), "a read must never destroy an unknown value")
        XCTAssertTrue(reEncoded.contains("confidente"))
    }

    /// The legacy table must stay a frozen literal. Deriving it from `Fr`
    /// would re-create the exact coupling FCH-09 removes.
    func test_FCH09_legacyTableIsFrozen_notDerivedFromCurrentCopy() {
        XCTAssertEqual(Etat.legacyFrenchTokens.count, 4)
        XCTAssertEqual(Ressenti.legacyFrenchTokens.count, 3)
        XCTAssertEqual(RoleContexte.legacyFrenchTokens.count, 6)
        for (french, value) in Etat.legacyFrenchTokens {
            XCTAssertEqual(french, value.label, "frozen table is in sync with today's copy")
        }
    }

    // MARK: - MAP-03 / FCH-06 keyed on identifiers

    func test_MAP03_colorLookupByIdentifier_neverFallsBackForAKnownEtat() {
        for etat in Etat.allCases {
            let color = EtatColors.color(for: etat)
            XCTAssertNotEqual(
                color.background, CarteTheme.surface,
                "\(etat.rawValue) must resolve to its palette color, not the unset fallback"
            )
        }
    }

    func test_FCH09_labelsResolveThroughFr_soCopyStaysTheSingleSourceOfDisplay() {
        XCTAssertEqual(Etat.busy.label, Fr.t(.etatBusy))
        XCTAssertEqual(Ressenti.ambivalent.label, Fr.t(.ressentiAmbivalente))
        XCTAssertEqual(RoleContexte.cohort.label, Fr.t(.rolePromo))
    }

    func test_FCH09_fromLabel_roundTripsEveryValue() {
        for etat in Etat.allCases { XCTAssertEqual(Etat.fromLabel(etat.label), etat) }
        for value in Ressenti.allCases { XCTAssertEqual(Ressenti.fromLabel(value.label), value) }
        for role in RoleContexte.allCases { XCTAssertEqual(RoleContexte.fromLabel(role.label), role) }
        XCTAssertNil(Etat.fromLabel("pas un état"))
    }
}
