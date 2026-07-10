/// Networking (FS-07; reference `apps/mobile/src/api/client.ts`).
///
/// PRIVACY INVARIANT (ONB-05 / G1 / ios-specialist rule 3): the ONLY
/// user-data shapes this module can send are `phoneHash`, `code`,
/// `displayName`, and the opaque encrypted vault `{ blob, version }`. There
/// is deliberately NO type here for rings, roles, état, ressenti, scope
/// names, or filter reasons — if you need to add one, stop: you are breaking
/// the product's core promise. `ApiClientPrivacyInvariantTests` asserts this
/// structurally via `Mirror` over every `Encodable` request body.
import Foundation

// MARK: - Wire types

public struct OtpRequestBody: Encodable, Sendable {
    public let phoneHash: String
    public init(phoneHash: String) { self.phoneHash = phoneHash }
}

public struct OtpRequestResponse: Decodable, Sendable {
    /// POC only: the API returns the code in non-production (no SMS provider yet, OQ-IDT-1).
    public let devCode: String?
}

public struct OtpVerifyBody: Encodable, Sendable {
    public let phoneHash: String
    public let code: String
    public let displayName: String?
    public init(phoneHash: String, code: String, displayName: String? = nil) {
        self.phoneHash = phoneHash
        self.code = code
        self.displayName = displayName
    }
}

public struct OtpVerifyResponse: Decodable, Sendable {
    public let accessToken: String
    public let refreshToken: String
}

public struct VaultPushBody: Encodable, Sendable {
    public let blob: String
    public let version: Int
    public init(blob: String, version: Int) {
        self.blob = blob
        self.version = version
    }
}

private struct VaultPushResponseBody: Decodable, Sendable {
    let version: Int
}

private struct VaultGetResponseBody: Decodable, Sendable {
    let blob: String
    let version: Int
}

public struct EncryptedVaultBlob: Equatable, Sendable {
    /// base64 AES-256-GCM ciphertext — the server can never read it.
    public let blob: String
    public let version: Int
}

public enum VaultPushResult: Equatable, Sendable {
    case ok(version: Int)
    case conflict
}

public enum ApiError: Error, Equatable, Sendable {
    case http(status: Int)
    case decoding
}

// MARK: - Transport seam (test double avoids real network in `swift test`)

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public final class URLSessionHTTPTransport: HTTPTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ApiError.http(status: -1)
        }
        return (data, http)
    }
}

// MARK: - Client

public actor ApiClient: VaultSyncApi {
    private let baseURL: URL
    private let transport: HTTPTransport
    private let session: Session

    public init(baseURL: URL, transport: HTTPTransport, session: Session) {
        self.baseURL = baseURL
        self.transport = transport
        self.session = session
    }

    private func request(path: String, method: String, body: Data?) throws -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        if let token = try session.getAccessToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        req.httpBody = body
        return req
    }

    // --- Auth (FS-07 IDT-01..03) -------------------------------------------

    public func requestOtp(phoneHash: String) async throws -> OtpRequestResponse {
        let body = try JSONEncoder().encode(OtpRequestBody(phoneHash: phoneHash))
        let req = try request(path: "auth/otp/request", method: "POST", body: body)
        let (data, response) = try await transport.send(req)
        guard (200...299).contains(response.statusCode) else {
            throw ApiError.http(status: response.statusCode)
        }
        return try JSONDecoder().decode(OtpRequestResponse.self, from: data)
    }

    public func verifyOtp(phoneHash: String, code: String, displayName: String?) async throws -> OtpVerifyResponse {
        let body = try JSONEncoder().encode(
            OtpVerifyBody(phoneHash: phoneHash, code: code, displayName: displayName)
        )
        let req = try request(path: "auth/otp/verify", method: "POST", body: body)
        let (data, response) = try await transport.send(req)
        guard (200...299).contains(response.statusCode) else {
            throw ApiError.http(status: response.statusCode)
        }
        return try JSONDecoder().decode(OtpVerifyResponse.self, from: data)
    }

    // --- Vault (FS-07 VLT-02): opaque blob only -----------------------------

    public func pushVault(blob: String, version: Int) async throws -> VaultPushResult {
        let body = try JSONEncoder().encode(VaultPushBody(blob: blob, version: version))
        let req = try request(path: "vault", method: "POST", body: body)
        let (data, response) = try await transport.send(req)
        if response.statusCode == 409 {
            return .conflict
        }
        guard (200...299).contains(response.statusCode) else {
            throw ApiError.http(status: response.statusCode)
        }
        let decoded = try JSONDecoder().decode(VaultPushResponseBody.self, from: data)
        return .ok(version: decoded.version)
    }

    public func getVault() async throws -> EncryptedVaultBlob? {
        let req = try request(path: "vault", method: "GET", body: nil)
        let (data, response) = try await transport.send(req)
        if response.statusCode == 404 {
            return nil
        }
        guard (200...299).contains(response.statusCode) else {
            throw ApiError.http(status: response.statusCode)
        }
        let decoded = try JSONDecoder().decode(VaultGetResponseBody.self, from: data)
        return EncryptedVaultBlob(blob: decoded.blob, version: decoded.version)
    }
}
