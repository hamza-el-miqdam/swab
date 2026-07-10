/// The on-device vault (FS-07 VLT-01, ios-specialist rule 6).
///
/// All four classification axes live HERE and only here: intimité (ring),
/// rôles, état, ressenti. In memory while the app runs; at rest as an
/// AES-256-GCM blob in the key-value store. Nothing in this module talks to
/// the network — `VaultSync` ships the ciphertext, never the fields.
///
/// Accessors return **fresh value copies** (`VaultContact`/`VaultData` are
/// structs), never live references into `cache` — the VLT-01 aliasing
/// regression from the RN reference is reproducible with Swift reference
/// types too; structs avoid the whole class of bug structurally.
import Foundation

public typealias IntimacyRing = Int  // 1...4; validated at call sites (VaultRing).

public enum VaultRing {
    public static let range = 1...4
}

public struct VaultContact: Codable, Equatable, Sendable {
    public var id: String
    public var displayName: String
    /// Client-side hash (IDT-06); stays local until FS-07 discovery runs.
    public var phoneHash: String?
    /// Intimité — 1 = innermost ring. Unset until calibrated (ONB-04).
    public var ring: Int?
    public var roles: [String]
    public var etat: String?
    public var ressenti: String?

    public init(
        id: String,
        displayName: String,
        phoneHash: String? = nil,
        ring: Int? = nil,
        roles: [String] = [],
        etat: String? = nil,
        ressenti: String? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.phoneHash = phoneHash
        self.ring = ring
        self.roles = roles
        self.etat = etat
        self.ressenti = ressenti
    }
}

/// Unknown-field-tolerant by construction: `Codable` synthesis ignores keys
/// not declared here, so the shape can grow with FS-03/04/06 without
/// breaking round-trips of older blobs.
public struct VaultData: Codable, Equatable, Sendable {
    public var contacts: [VaultContact]

    public init(contacts: [VaultContact] = []) {
        self.contacts = contacts
    }
}

public enum VaultError: Error, Equatable, Sendable {
    case blobUnavailable
}

public actor Vault {
    private static let blobKey = "vault.blob.v1"
    private static let versionKey = "vault.version.v1"

    private let kv: KeyValueStore
    private let keyStore: VaultKeyStore
    private var cache: VaultData?
    private var version = 1

    public init(kv: KeyValueStore, secureStore: SecureStore) {
        self.kv = kv
        self.keyStore = VaultKeyStore(store: secureStore)
    }

    private func hydrate() async throws -> VaultData {
        if let cache {
            return cache
        }
        let blob = await kv.get(Self.blobKey)
        let storedVersion = await kv.get(Self.versionKey)
        version = storedVersion.flatMap { Int($0) } ?? 1

        guard let blob else {
            let empty = VaultData()
            cache = empty
            return empty
        }
        let key = try keyStore.getOrCreateKey()
        let plaintext = try VaultCrypto.decrypt(blobBase64: blob, key: key)
        let data = try JSONDecoder().decode(VaultData.self, from: Data(plaintext.utf8))
        cache = data
        return data
    }

    private func persist(_ data: VaultData) async throws {
        let key = try keyStore.getOrCreateKey()
        version += 1
        let json = try JSONEncoder().encode(data)
        let plaintext = String(decoding: json, as: UTF8.self)
        let blob = try VaultCrypto.encrypt(plaintext: plaintext, key: key)
        await kv.set(Self.blobKey, value: blob)
        await kv.set(Self.versionKey, value: String(version))
        cache = data
    }

    public func getContacts() async throws -> [VaultContact] {
        try await hydrate().contacts
    }

    @discardableResult
    public func addContact(displayName: String, phoneHash: String? = nil) async throws -> VaultContact {
        var data = try await hydrate()
        let contact = VaultContact(id: UUID().uuidString, displayName: displayName, phoneHash: phoneHash)
        data.contacts.append(contact)
        try await persist(data)
        return contact
    }

    public func setRing(id: String, ring: Int) async throws {
        try await mutateContact(id: id) { $0.ring = ring }
    }

    public func setEtat(id: String, etat: String?) async throws {
        try await mutateContact(id: id) { $0.etat = etat }
    }

    public func setRessenti(id: String, ressenti: String?) async throws {
        try await mutateContact(id: id) { $0.ressenti = ressenti }
    }

    private func mutateContact(id: String, _ mutate: (inout VaultContact) -> Void) async throws {
        var data = try await hydrate()
        guard let index = data.contacts.firstIndex(where: { $0.id == id }) else {
            return
        }
        mutate(&data.contacts[index])
        try await persist(data)
    }

    /// Ciphertext + version for `VaultSync` — the only exit door.
    public func getEncryptedVault() async throws -> (blob: String, version: Int) {
        let data = try await hydrate()
        var blob = await kv.get(Self.blobKey)
        if blob == nil {
            try await persist(data)
            blob = await kv.get(Self.blobKey)
        }
        guard let blob else {
            throw VaultError.blobUnavailable
        }
        return (blob, version)
    }

    public func setVaultVersion(_ next: Int) async {
        version = next
        await kv.set(Self.versionKey, value: String(next))
    }
}
