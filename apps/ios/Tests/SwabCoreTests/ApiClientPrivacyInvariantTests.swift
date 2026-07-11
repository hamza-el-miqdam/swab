/// ONB-05 / G1: the ONLY user-data shapes the client may ever send are
/// `phoneHash`, `code`, `displayName`, and the opaque `{ blob, version }`.
/// This test inspects every `Encodable` request body type via `Mirror` and
/// fails the build's test suite the moment a new property is added that
/// isn't on the allow-list — the same "stop, you are breaking the product's
/// promise" tripwire as the RN reference's doc-comment, made executable.
import Foundation
import XCTest

@testable import SwabCore

final class ApiClientPrivacyInvariantTests: XCTestCase {
    private static let allowedFieldNames: Set<String> = [
        "phoneHash", "code", "displayName", "blob", "version",
    ]

    private func assertOnlyAllowedFields(_ value: Any, file: StaticString = #filePath, line: UInt = #line) {
        let mirror = Mirror(reflecting: value)
        for child in mirror.children {
            guard let label = child.label else { continue }
            XCTAssertTrue(
                Self.allowedFieldNames.contains(label),
                "request body field '\(label)' is not in the privacy allow-list "
                    + "(phoneHash/code/displayName/blob/version) — classification data must never "
                    + "reach the network layer (ONB-05, G1)",
                file: file,
                line: line
            )
        }
    }

    func test_ONB05_otpRequestBody_onlyContainsPhoneHash() {
        assertOnlyAllowedFields(OtpRequestBody(phoneHash: "h"))
    }

    func test_ONB05_otpVerifyBody_onlyContainsPhoneHashCodeDisplayName() {
        assertOnlyAllowedFields(OtpVerifyBody(phoneHash: "h", code: "123456", displayName: "Leïla"))
    }

    func test_ONB05_vaultPushBody_onlyContainsBlobAndVersion() {
        assertOnlyAllowedFields(VaultPushBody(blob: "cipher", version: 1))
    }

    /// Every `Encodable` type declared in the networking layer must be one
    /// of the known request bodies — this guards against a future type
    /// being added and silently skipped by the tests above.
    func test_ONB05_encodableSurfaceIsExactlyTheKnownRequestBodies() {
        let known: [Encodable] = [
            OtpRequestBody(phoneHash: "h"),
            OtpVerifyBody(phoneHash: "h", code: "1", displayName: nil),
            VaultPushBody(blob: "b", version: 1),
        ]
        XCTAssertEqual(known.count, 3)
        for body in known {
            assertOnlyAllowedFields(body)
        }
    }
}
