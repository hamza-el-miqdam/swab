/// Talks to the REAL local API stack (`docker compose up`, same
/// `http://127.0.0.1:3001` the app's production `ApiClient` is wired to in
/// `App/SwabApp.swift`) directly from the test process — used only to (a)
/// confirm the stack is reachable before driving the UI, and (b) fetch the
/// dev-mode OTP code the same way the API hands it to the app
/// (`OtpRequestResponse.devCode`, `apps/api/src/routes/auth.ts`), never a
/// hardcoded/guessed value.
import Foundation

enum DevBackendError: Error, CustomStringConvertible {
    case unexpectedStatus(Int)
    case missingDevCode

    var description: String {
        switch self {
        case .unexpectedStatus(let code): return "unexpected HTTP status \(code)"
        case .missingDevCode: return "response had no devCode — is the API running in a non-production NODE_ENV?"
        }
    }
}

enum DevBackend {
    static let baseURL = URL(string: "http://127.0.0.1:3001")!

    /// Polls `/health` until it responds 2xx or `timeout` elapses. Fails the
    /// whole run fast and legibly if `docker compose up` isn't running,
    /// rather than letting every UI step time out mysteriously later.
    static func waitForHealth(timeout: TimeInterval = 15) async throws {
        let deadline = Date().addingTimeInterval(timeout)
        var lastError: Error = DevBackendError.unexpectedStatus(-1)
        while Date() < deadline {
            do {
                var req = URLRequest(url: baseURL.appendingPathComponent("health"))
                req.timeoutInterval = 3
                let (_, response) = try await URLSession.shared.data(for: req)
                if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                    return
                }
                lastError = DevBackendError.unexpectedStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
            } catch {
                lastError = error
            }
            try await Task.sleep(nanoseconds: 300_000_000)
        }
        throw lastError
    }

    /// Requests a fresh OTP for `phoneHash` against the exact endpoint
    /// `PhoneViewModel.requestCode` calls, and returns the `devCode` the API
    /// puts in the response body in non-production `NODE_ENV`.
    static func requestDevOtp(phoneHash: String) async throws -> String {
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/otp/request"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONEncoder().encode(["phoneHash": phoneHash])
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw DevBackendError.unexpectedStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        struct Resp: Decodable { let devCode: String? }
        let decoded = try JSONDecoder().decode(Resp.self, from: data)
        guard let code = decoded.devCode else { throw DevBackendError.missingDevCode }
        return code
    }

    /// A fresh, random E.164-shaped test phone number. Each test gets its
    /// own number so the API's per-phoneHash OTP throttle (max 3
    /// requests / 5 min, `apps/api/src/otp-store.ts`) never collides across
    /// runs of this suite.
    static func freshTestPhoneNumber() -> String {
        "+336" + String(format: "%08d", Int.random(in: 0...99_999_999))
    }
}
