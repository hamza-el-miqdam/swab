/// MAP-03 — état → color mapping. Also locks in the flagged "blueprint has
/// 5 états, we ship 4 (OQ-FCH-2 resolved 2026-08-09, issue #16: `en pause`
/// moved from ressenti to état)" divergence: this test enumerates exactly
/// the 4 shipped états and must fail loudly if a 5th silently appears.
import XCTest

@testable import SwabCore

final class EtatColorsTests: XCTestCase {
    func test_MAP03_availableMapsToItsBlueprintColor() {
        let color = EtatColors.color(for: .available)
        XCTAssertEqual(color.background, "#8FB59A")
        XCTAssertEqual(color.border, "#8FB59A")
    }

    func test_MAP03_busyMapsToItsBlueprintColor() {
        let color = EtatColors.color(for: .busy)
        XCTAssertEqual(color.background, "#C8917E")
    }

    func test_MAP03_awayMapsToItsBlueprintColor() {
        let color = EtatColors.color(for: .away)
        XCTAssertEqual(color.background, "#8AA0BE")
    }

    func test_MAP03_pausedMapsToItsColor() {
        let color = EtatColors.color(for: .paused)
        XCTAssertEqual(color.background, "#9A8FB5")
        XCTAssertEqual(color.border, "#9A8FB5")
    }

    func test_MAP03_unsetEtatFallsBackToNeutralSurfaceColor() {
        let color = EtatColors.color(for: nil)
        XCTAssertEqual(color.background, CarteTheme.surface)
        XCTAssertEqual(color.border, CarteTheme.line)
    }

    /// FCH-09 moved the "unrecognized" case one layer up: a token outside
    /// the vocabulary no longer reaches this lookup at all — it parses to
    /// `nil` and takes the same neutral path as an unset état.
    func test_MAP03_unrecognizedEtatFallsBackToNeutralSurfaceColorRatherThanCrashing() {
        XCTAssertNil(Etat.parse(stored: "not-a-real-etat"))
        let color = EtatColors.color(for: Etat.parse(stored: "not-a-real-etat"))
        XCTAssertEqual(color.background, CarteTheme.surface)
    }

    /// Divergence flag (do not silently expand): exactly 4 shipped états.
    func test_MAP03_shippedEtatVocabularyIsExactlyFour() {
        XCTAssertEqual(EtatColors.byEtat.count, 4)
    }
}
