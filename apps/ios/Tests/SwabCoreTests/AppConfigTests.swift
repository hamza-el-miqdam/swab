/// G1 — `AppConfig.load` fails fast on missing/invalid config rather than
/// silently falling back to a hardcoded value.
import Foundation
import XCTest

@testable import SwabCore

final class AppConfigTests: XCTestCase {
    func test_G1_missingBaseURL_throwsAtLoad() {
        XCTAssertThrowsError(try AppConfig.load(lookup: { _ in nil })) { error in
            XCTAssertEqual(error as? AppConfig.LoadError, .missingBaseURL)
        }
    }

    func test_G1_invalidBaseURL_throwsAtLoad() {
        let lookup: (String) -> String? = { key in
            key == "SwabApiBaseURL" ? "not a url" : nil
        }
        XCTAssertThrowsError(try AppConfig.load(lookup: lookup)) { error in
            XCTAssertEqual(error as? AppConfig.LoadError, .invalidBaseURL("not a url"))
        }
    }

    func test_G1_nonLoopbackHttpURL_isRejected() {
        let lookup: (String) -> String? = { key in
            switch key {
            case "SwabApiBaseURL": return "http://api.swab.example.com"
            case "SwabPhoneHashSalt": return "some-deployment-salt"
            default: return nil
            }
        }
        XCTAssertThrowsError(try AppConfig.load(lookup: lookup)) { error in
            XCTAssertEqual(
                error as? AppConfig.LoadError,
                .nonLoopbackRequiresHTTPS("http://api.swab.example.com")
            )
        }
    }

    func test_G1_nonLoopbackHttpsURL_isAccepted() throws {
        let lookup: (String) -> String? = { key in
            switch key {
            case "SwabApiBaseURL": return "https://api.swab.example.com"
            case "SwabPhoneHashSalt": return "some-deployment-salt"
            default: return nil
            }
        }
        let config = try AppConfig.load(lookup: lookup)
        XCTAssertEqual(config.apiBaseURL, URL(string: "https://api.swab.example.com")!)
    }

    func test_G1_loopbackHttp_isAccepted() throws {
        let lookup: (String) -> String? = { key in
            switch key {
            case "SwabApiBaseURL": return "http://127.0.0.1:3001"
            case "SwabPhoneHashSalt": return "swab-poc-phone-salt-v1"
            default: return nil
            }
        }
        let config = try AppConfig.load(lookup: lookup)
        XCTAssertEqual(config.apiBaseURL, URL(string: "http://127.0.0.1:3001")!)
        XCTAssertEqual(config.phoneHashSalt, "swab-poc-phone-salt-v1")
    }

    func test_G1_missingSalt_throwsAtLoad() {
        let lookup: (String) -> String? = { key in
            key == "SwabApiBaseURL" ? "http://127.0.0.1:3001" : nil
        }
        XCTAssertThrowsError(try AppConfig.load(lookup: lookup)) { error in
            XCTAssertEqual(error as? AppConfig.LoadError, .missingSalt)
        }
    }

    /// IDT-06: a deployment-scoped salt override changes the hash
    /// deterministically — verified against a precomputed vector, not just
    /// "differs from default", so a silent salt-computation regression
    /// (e.g. dropping the salt entirely) still fails this test.
    func test_IDT06_saltOverride_changesHashDeterministically() {
        let defaultHash = PhoneHash.hash("+15551234567")
        let overrideHash = PhoneHash.hash("+15551234567", salt: "other-deployment-salt")
        XCTAssertNotEqual(defaultHash, overrideHash)
        XCTAssertEqual(
            overrideHash,
            "0aafae7e6cee2461aa4ac29504eecb2fae0b2f9231b4c3a6d21601594c068b4f",
            "precomputed sha256(\"other-deployment-salt:+15551234567\")"
        )
    }
}
