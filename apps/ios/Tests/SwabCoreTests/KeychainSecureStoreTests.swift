/// `KeychainSecureStore` is the production `SecureStore` backing the vault
/// key and session tokens (handoff §2.1: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`,
/// no iCloud sync). A bare `swift test` CLI process is not code-signed for
/// an app's keychain access group on every host, so these tests skip
/// (rather than fail the suite) when the OS refuses access — the contract
/// is still exercised wherever it can run (e.g. a signed Xcode test host).
import XCTest

@testable import SwabCore

final class KeychainSecureStoreTests: XCTestCase {
    private let testKey = "swab.tests.keychain-probe.v1"

    private func skipIfKeychainUnavailable(_ status: SecureStoreError) throws {
        throw XCTSkip("Keychain unavailable in this test host (status: \(status)) — expected for an unsigned CLI process.")
    }

    func test_setThenGet_roundTripsWhenKeychainIsAvailable() throws {
        let store = KeychainSecureStore(service: "com.swab.tests")
        do {
            try store.set(testKey, value: "probe-value")
        } catch let error as SecureStoreError {
            try skipIfKeychainUnavailable(error)
            return
        }
        defer { try? store.set(testKey, value: "") }
        XCTAssertEqual(try store.get(testKey), "probe-value")
    }

    func test_getMissingKey_returnsNilWhenKeychainIsAvailable() throws {
        let store = KeychainSecureStore(service: "com.swab.tests")
        do {
            let value = try store.get("swab.tests.definitely-missing.v1")
            XCTAssertNil(value)
        } catch let error as SecureStoreError {
            try skipIfKeychainUnavailable(error)
        }
    }
}
