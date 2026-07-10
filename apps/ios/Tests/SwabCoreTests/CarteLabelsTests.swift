/// MAP-08 — accessibility label vocabulary, shared by the radial map and
/// the list fallback so both surfaces announce identically.
import XCTest

@testable import SwabCore

final class CarteLabelsTests: XCTestCase {
    func test_MAP08_contactLabelIncludesRingWhenPlaced() {
        let contact = VaultContact(id: "1", displayName: "Léa", ring: 1)
        XCTAssertEqual(CarteLabels.contactLabel(contact), "Léa — Très proche")
    }

    func test_MAP08_contactLabelIsPlainNameWhenUnplaced() {
        let contact = VaultContact(id: "1", displayName: "Léa")
        XCTAssertEqual(CarteLabels.contactLabel(contact), "Léa")
    }

    func test_MAP08_contactLabelCoversEveryRing() {
        for ring in MapGeometry.rings {
            let contact = VaultContact(id: "1", displayName: "Sam", ring: ring)
            XCTAssertTrue(CarteLabels.contactLabel(contact).hasSuffix(CarteLabels.ringLabel[ring]!))
        }
    }

    func test_initialsTakesUpToTwoUppercasedInitials() {
        XCTAssertEqual(CarteLabels.initials("Léa Martin"), "LM")
        XCTAssertEqual(CarteLabels.initials("Sam"), "S")
        XCTAssertEqual(CarteLabels.initials("jean pierre dupont"), "JP")
    }

    func test_initialsHandlesExtraWhitespaceAndEmptyName() {
        XCTAssertEqual(CarteLabels.initials("  Léa   Martin  "), "LM")
        XCTAssertEqual(CarteLabels.initials(""), "")
    }
}
