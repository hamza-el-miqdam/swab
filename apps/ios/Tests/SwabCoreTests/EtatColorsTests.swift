/// MAP-03 — état → color mapping. Also locks in the flagged "blueprint has
/// 5 états, we ship 3" divergence: this test enumerates exactly the 3
/// shipped états and must fail loudly if a 4th silently appears.
import XCTest

@testable import SwabCore

final class EtatColorsTests: XCTestCase {
    func test_MAP03_availableMapsToItsBlueprintColor() {
        let color = EtatColors.color(for: Fr.t(.etatAvailable))
        XCTAssertEqual(color.background, "#8FB59A")
        XCTAssertEqual(color.border, "#8FB59A")
    }

    func test_MAP03_busyMapsToItsBlueprintColor() {
        let color = EtatColors.color(for: Fr.t(.etatBusy))
        XCTAssertEqual(color.background, "#C8917E")
    }

    func test_MAP03_awayMapsToItsBlueprintColor() {
        let color = EtatColors.color(for: Fr.t(.etatAway))
        XCTAssertEqual(color.background, "#8AA0BE")
    }

    func test_MAP03_unsetEtatFallsBackToNeutralSurfaceColor() {
        let color = EtatColors.color(for: nil)
        XCTAssertEqual(color.background, CarteTheme.surface)
        XCTAssertEqual(color.border, CarteTheme.line)
    }

    func test_MAP03_unrecognizedEtatFallsBackToNeutralSurfaceColorRatherThanCrashing() {
        let color = EtatColors.color(for: "not-a-real-etat")
        XCTAssertEqual(color.background, CarteTheme.surface)
    }

    /// Divergence flag (do not silently expand): exactly 3 shipped états.
    func test_MAP03_shippedEtatVocabularyIsExactlyThree() {
        XCTAssertEqual(EtatColors.byLabel.count, 3)
    }
}
