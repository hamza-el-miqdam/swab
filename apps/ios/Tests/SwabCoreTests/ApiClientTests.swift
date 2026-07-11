/// FS-07 networking behavior: status-code handling (409/404), auth header
/// attachment, and the `devCode` POC pass-through — against a fake
/// `HTTPTransport` so tests never touch the real network.
import Foundation
import XCTest

@testable import SwabCore

private actor FakeHTTPTransport: HTTPTransport {
    struct Stub {
        let status: Int
        let body: Data
    }

    private var stub: Stub
    private(set) var lastRequest: URLRequest?

    init(status: Int, json: String) {
        stub = Stub(status: status, body: Data(json.utf8))
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        lastRequest = request
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: stub.status,
            httpVersion: nil,
            headerFields: nil
        )!
        return (stub.body, response)
    }
}

final class ApiClientTests: XCTestCase {
    private func makeClient(transport: HTTPTransport, sessionStore: SecureStore = InMemorySecureStore()) -> ApiClient {
        ApiClient(
            baseURL: URL(string: "http://localhost:3001")!,
            transport: transport,
            session: Session(store: sessionStore)
        )
    }

    func test_requestOtp_devModeEchoesCode() async throws {
        let transport = FakeHTTPTransport(status: 200, json: #"{"devCode":"123456"}"#)
        let client = makeClient(transport: transport)
        let result = try await client.requestOtp(phoneHash: "h")
        XCTAssertEqual(result.devCode, "123456")
    }

    func test_requestOtp_prodModeHasNoDevCode() async throws {
        let transport = FakeHTTPTransport(status: 200, json: "{}")
        let client = makeClient(transport: transport)
        let result = try await client.requestOtp(phoneHash: "h")
        XCTAssertNil(result.devCode)
    }

    func test_verifyOtp_attachesBearerTokenWhenSessionExists() async throws {
        let sessionStore = InMemorySecureStore()
        try sessionStore.set("swab.session.access.v1", value: "existing-token")
        let transport = FakeHTTPTransport(status: 200, json: #"{"accessToken":"a","refreshToken":"r"}"#)
        let client = makeClient(transport: transport, sessionStore: sessionStore)

        _ = try await client.verifyOtp(phoneHash: "h", code: "123456", displayName: nil)

        let request = await transport.lastRequest
        XCTAssertEqual(request?.value(forHTTPHeaderField: "authorization"), "Bearer existing-token")
    }

    func test_pushVault_409_returnsConflictNotError() async throws {
        let transport = FakeHTTPTransport(status: 409, json: "{}")
        let client = makeClient(transport: transport)
        let result = try await client.pushVault(blob: "b", version: 1)
        XCTAssertEqual(result, .conflict)
    }

    func test_pushVault_200_returnsServerVersion() async throws {
        let transport = FakeHTTPTransport(status: 200, json: #"{"version":7}"#)
        let client = makeClient(transport: transport)
        let result = try await client.pushVault(blob: "b", version: 1)
        XCTAssertEqual(result, .ok(version: 7))
    }

    func test_getVault_404_returnsNilNotError() async throws {
        let transport = FakeHTTPTransport(status: 404, json: "{}")
        let client = makeClient(transport: transport)
        let result = try await client.getVault()
        XCTAssertNil(result)
    }

    func test_getVault_500_throwsHttpError() async throws {
        let transport = FakeHTTPTransport(status: 500, json: "{}")
        let client = makeClient(transport: transport)
        do {
            _ = try await client.getVault()
            XCTFail("expected an error")
        } catch ApiError.http(let status) {
            XCTAssertEqual(status, 500)
        }
    }
}
