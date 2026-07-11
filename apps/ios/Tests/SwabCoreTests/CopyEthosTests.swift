/// ONB-09: no gamification — no progress percentages, no confetti, no
/// "X contacts added!" counters. Step indication is positional only.
/// Mirrors `apps/mobile/src/__tests__/no-gamification.onb09.test.ts`: scan
/// every ported string for digits used as a progress/counter signal.
import XCTest

@testable import SwabCore

final class CopyEthosTests: XCTestCase {
    /// Digits are allowed only inside the placeholder examples that show a
    /// phone number / OTP shape (`phone.placeholder`, `otp.placeholder`) —
    /// every other string must contain no digits at all, since a digit
    /// anywhere else in onboarding copy is a counter/percentage smell.
    private static let digitsAllowed: Set<I18nKey> = [.phonePlaceholder]

    func test_ONB09_noDigitsOutsideThePhonePlaceholder() {
        for key in I18nKey.allCases {
            let value = Fr.t(key)
            let containsDigit = value.contains { $0.isASCII && $0.isNumber }
            if Self.digitsAllowed.contains(key) {
                continue
            }
            XCTAssertFalse(containsDigit, "'\(key.rawValue)' = \"\(value)\" contains a digit (ONB-09 smell)")
        }
    }

    func test_ONB09_noPercentSign() {
        for key in I18nKey.allCases {
            XCTAssertFalse(Fr.t(key).contains("%"), "'\(key.rawValue)' contains a percent sign (ONB-09)")
        }
    }

    /// Celebration/gamification vocabulary that must never appear verbatim.
    func test_ONB09_noCelebrationOrGamificationVocabulary() {
        let banned = ["bravo", "félicitations", "streak", "badge", "score", "niveau", "confetti"]
        for key in I18nKey.allCases {
            let lowered = Fr.t(key).lowercased()
            for word in banned {
                XCTAssertFalse(
                    lowered.contains(word),
                    "'\(key.rawValue)' contains banned gamification word '\(word)'"
                )
            }
        }
    }

    func test_allKeysHaveNonEmptyStrings() {
        for key in I18nKey.allCases {
            XCTAssertFalse(Fr.t(key).isEmpty, "'\(key.rawValue)' has no copy")
        }
    }

    /// Spot-check a handful of strings byte-for-byte against the RN
    /// reference (`apps/mobile/src/i18n/fr.ts`) to catch accidental
    /// "improvement" of the verbatim copy, including typographic apostrophes.
    func test_verbatimSpotChecks() {
        XCTAssertEqual(Fr.t(.brandName), "swab · صواب")
        XCTAssertEqual(Fr.t(.welcomeTagline), "Dis ce dont tu as envie. À qui tu veux.")
        XCTAssertEqual(Fr.t(.phoneError), "Ça n’a pas marché. Réessaie dans un instant.")
        XCTAssertEqual(
            Fr.t(.donePromise),
            "Personne — ni eux, ni nous — ne voit comment tu l’as remplie."
        )
        XCTAssertEqual(Fr.t(.ring1), "Très proche")
        XCTAssertEqual(Fr.t(.ring4), "Plus loin")
    }
}
