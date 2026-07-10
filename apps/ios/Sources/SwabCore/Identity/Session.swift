/// Session tokens (IDT-02) live in the OS keychain via `SecureStore`.
import Foundation

public struct SessionTokens: Equatable, Sendable {
    public let accessToken: String
    public let refreshToken: String

    public init(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

public struct Session: Sendable {
    static let accessKey = "swab.session.access.v1"
    static let refreshKey = "swab.session.refresh.v1"

    private let store: SecureStore

    public init(store: SecureStore) {
        self.store = store
    }

    public func saveTokens(_ tokens: SessionTokens) throws {
        try store.set(Self.accessKey, value: tokens.accessToken)
        try store.set(Self.refreshKey, value: tokens.refreshToken)
    }

    public func getAccessToken() throws -> String? {
        try store.get(Self.accessKey)
    }
}
