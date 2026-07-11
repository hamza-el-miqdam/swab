/// Secret string storage abstraction — backs both the vault key
/// (`swab.vault.key.v1`) and session tokens (`swab.session.{access,refresh}.v1`).
/// Production: Keychain, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, no
/// iCloud sync (handoff §2.1). Tests: in-memory double, so `swift test` runs
/// without keychain entitlements (a bare `swift test` CLI process is not
/// code-signed/sandboxed for Keychain access on some CI hosts).
import Foundation
import Security

public protocol SecureStore: Sendable {
    func get(_ key: String) throws -> String?
    func set(_ key: String, value: String) throws
}

public enum SecureStoreError: Error, Equatable, Sendable {
    case keychain(OSStatus)
}

public final class InMemorySecureStore: SecureStore, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: String] = [:]

    public init() {}

    public func get(_ key: String) throws -> String? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }

    public func set(_ key: String, value: String) throws {
        lock.lock()
        defer { lock.unlock() }
        storage[key] = value
    }
}

/// `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` — never synced to iCloud,
/// never available before first unlock.
public final class KeychainSecureStore: SecureStore, @unchecked Sendable {
    private let service: String

    public init(service: String = "com.swab.app") {
        self.service = service
    }

    private func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    public func get(_ key: String) throws -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = result as? Data else {
            throw SecureStoreError.keychain(status)
        }
        return String(data: data, encoding: .utf8)
    }

    public func set(_ key: String, value: String) throws {
        let data = Data(value.utf8)
        let query = baseQuery(for: key)

        let existsStatus = SecItemCopyMatching(query as CFDictionary, nil)
        if existsStatus == errSecSuccess {
            let updateStatus = SecItemUpdate(
                query as CFDictionary,
                [kSecValueData as String: data] as CFDictionary
            )
            guard updateStatus == errSecSuccess else {
                throw SecureStoreError.keychain(updateStatus)
            }
            return
        }

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw SecureStoreError.keychain(addStatus)
        }
    }
}
