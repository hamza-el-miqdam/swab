/// Plain (non-secret) key-value storage. Mirrors `apps/mobile/src/lib/db.ts`:
/// only ever stores the onboarding step (plain — not classification data)
/// and the ENCRYPTED vault blob + its version (ciphertext only; see
/// `Vault.swift`). Classification data never touches this store unencrypted.
import Foundation

public protocol KeyValueStore: Sendable {
    func get(_ key: String) async -> String?
    func set(_ key: String, value: String) async
}

/// Test double / ephemeral in-process store.
public actor InMemoryKeyValueStore: KeyValueStore {
    private var storage: [String: String] = [:]

    public init() {}

    public func get(_ key: String) async -> String? {
        storage[key]
    }

    public func set(_ key: String, value: String) async {
        storage[key] = value
    }
}

/// File-backed JSON store. Semantics (not storage engine) must match the RN
/// reference's SQLite kv table: last-write-wins per key, synchronous-feeling
/// read-your-writes via an in-memory cache backed by an actor.
public actor FileKeyValueStore: KeyValueStore {
    private let url: URL
    private var cache: [String: String]

    public init(url: URL) {
        self.url = url
        if let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode([String: String].self, from: data)
        {
            cache = decoded
        } else {
            cache = [:]
        }
    }

    public func get(_ key: String) async -> String? {
        cache[key]
    }

    public func set(_ key: String, value: String) async {
        cache[key] = value
        persist()
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(cache) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
