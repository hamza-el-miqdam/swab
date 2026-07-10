/// IDT-02 session token storage.
import XCTest

@testable import SwabCore

final class SessionTests: XCTestCase {
    func test_getAccessToken_startsNil() throws {
        let session = Session(store: InMemorySecureStore())
        XCTAssertNil(try session.getAccessToken())
    }

    func test_saveTokens_thenGetAccessToken_roundTrips() throws {
        let store = InMemorySecureStore()
        let session = Session(store: store)
        try session.saveTokens(SessionTokens(accessToken: "access-1", refreshToken: "refresh-1"))

        XCTAssertEqual(try session.getAccessToken(), "access-1")
        XCTAssertEqual(try store.get("swab.session.refresh.v1"), "refresh-1")
    }

    func test_saveTokens_overwritesPreviousTokens() throws {
        let store = InMemorySecureStore()
        let session = Session(store: store)
        try session.saveTokens(SessionTokens(accessToken: "old", refreshToken: "old-r"))
        try session.saveTokens(SessionTokens(accessToken: "new", refreshToken: "new-r"))
        XCTAssertEqual(try session.getAccessToken(), "new")
    }
}
