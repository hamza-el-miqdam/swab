/// Plain (non-secret) key-value storage. Mirrors `apps/mobile/src/lib/db.ts`:
/// only ever stores the onboarding step (plain — not classification data)
/// and the ENCRYPTED vault blob + its version (ciphertext only; see
/// `Vault.swift`). Classification data never touches this store unencrypted.
import Foundation

public protocol KeyValueStore: Sendable {
    func get(_ key: String) async -> String?
    func set(_ key: String, value: String) async
    /// SUG-IOS-009: write several keys as one logical unit. The default
    /// implementation loops over `set` (fine for `InMemoryKeyValueStore`,
    /// which has no torn-write risk); `FileKeyValueStore` overrides it to
    /// do a single file write, since two separate writes to a pair like the
    /// vault blob + its version could leave a crash between them with a
    /// stale version next to a fresh blob.
    func setMany(_ entries: [String: String]) async
}

extension KeyValueStore {
    public func setMany(_ entries: [String: String]) async {
        for (key, value) in entries {
            await set(key, value: value)
        }
    }
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
    private let reporter: ErrorReporter

    public init(url: URL, reporter: ErrorReporter = NoopErrorReporter()) {
        self.url = url
        self.reporter = reporter
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

    /// SUG-IOS-009: mutate every entry in memory first, then persist once —
    /// one file write instead of one per key, so a pair like the vault blob
    /// + its version either both land or neither does.
    public func setMany(_ entries: [String: String]) async {
        for (key, value) in entries {
            cache[key] = value
        }
        persist()
    }

    /// G3: a dropped write here is not observable to `KeyValueStore`
    /// callers (`set` returns `Void`) — report it instead of discarding it.
    /// `errorDescription` is a fixed code, never `localizedDescription`
    /// (which for `Error.write` failures can embed the file path).
    ///
    /// SUG-IOS-009: `.completeFileProtectionUnlessOpen` matches the
    /// Keychain-backed wrap key's `WhenUnlockedThisDeviceOnly`
    /// (`SecureStore.swift`) — `UnlessOpen` rather than the strictest class
    /// so a write already in flight isn't invalidated by the device
    /// locking mid-write; revisit if SUG-IOS-002 adds writes while locked.
    private func persist() {
        guard let data = try? JSONEncoder().encode(cache) else {
            reporter.report(ReportedError(domain: "storage.kv", operation: "persist", errorDescription: "encodeFailed"))
            return
        }
        do {
            try data.write(to: url, options: [.atomic, .completeFileProtectionUnlessOpen])
        } catch {
            reporter.report(ReportedError(domain: "storage.kv", operation: "persist", errorDescription: "writeFailed"))
        }
    }
}
