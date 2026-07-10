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

public struct VaultContact: Codable, Equatable, Hashable, Sendable {
    public var id: String
    public var displayName: String
    /// Client-side hash (IDT-06); stays local until FS-07 discovery runs.
    public var phoneHash: String?
    /// Intimité — 1 = innermost ring. Unset until calibrated (ONB-04).
    public var ring: Int?
    public var roles: [String]
    public var etat: String?
    public var ressenti: String?
    /// FCH-08: mirrors FS-07's `ContactLink.targetId` — nil while this
    /// contact is a pending, not-yet-joined invite (IDT-07), non-nil once
    /// the link resolves to a real Swab user. No separate `ContactLink`
    /// type exists in this client yet, so this lives directly on the
    /// contact for now.
    public var targetId: String?
    /// FCH-04: local-only history feed (axis changes + relationship
    /// events), newest first by convention at the call sites that append
    /// to it. Never leaves the vault boundary.
    public var history: [FicheHistoryEvent]
    /// FCH-05: staleness nudge timer state — when any axis last changed,
    /// and whether a "À revoir plus tard" snooze is still in effect.
    public var lastAxisChangeAt: Date?
    public var stalenessSnoozedUntil: Date?

    public init(
        id: String,
        displayName: String,
        phoneHash: String? = nil,
        ring: Int? = nil,
        roles: [String] = [],
        etat: String? = nil,
        ressenti: String? = nil,
        targetId: String? = nil,
        history: [FicheHistoryEvent] = [],
        lastAxisChangeAt: Date? = nil,
        stalenessSnoozedUntil: Date? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.phoneHash = phoneHash
        self.ring = ring
        self.roles = roles
        self.etat = etat
        self.ressenti = ressenti
        self.targetId = targetId
        self.history = history
        self.lastAxisChangeAt = lastAxisChangeAt
        self.stalenessSnoozedUntil = stalenessSnoozedUntil
    }

    private enum CodingKeys: String, CodingKey {
        case id, displayName, phoneHash, ring, roles, etat, ressenti
        case targetId, history, lastAxisChangeAt, stalenessSnoozedUntil
    }

    /// Custom, not synthesized: `history` is a non-optional array added in
    /// FS-03, so a Wave 1/2 blob that predates it (no `history` key at all)
    /// must decode to `[]` rather than throwing — same "unknown-field-tolerant
    /// by construction" contract this type's doc comment already promises,
    /// extended to a newly-added required-shaped field.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        displayName = try c.decode(String.self, forKey: .displayName)
        phoneHash = try c.decodeIfPresent(String.self, forKey: .phoneHash)
        ring = try c.decodeIfPresent(Int.self, forKey: .ring)
        roles = try c.decodeIfPresent([String].self, forKey: .roles) ?? []
        etat = try c.decodeIfPresent(String.self, forKey: .etat)
        ressenti = try c.decodeIfPresent(String.self, forKey: .ressenti)
        targetId = try c.decodeIfPresent(String.self, forKey: .targetId)
        history = try c.decodeIfPresent([FicheHistoryEvent].self, forKey: .history) ?? []
        lastAxisChangeAt = try c.decodeIfPresent(Date.self, forKey: .lastAxisChangeAt)
        stalenessSnoozedUntil = try c.decodeIfPresent(Date.self, forKey: .stalenessSnoozedUntil)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(displayName, forKey: .displayName)
        try c.encodeIfPresent(phoneHash, forKey: .phoneHash)
        try c.encodeIfPresent(ring, forKey: .ring)
        try c.encode(roles, forKey: .roles)
        try c.encodeIfPresent(etat, forKey: .etat)
        try c.encodeIfPresent(ressenti, forKey: .ressenti)
        try c.encodeIfPresent(targetId, forKey: .targetId)
        try c.encode(history, forKey: .history)
        try c.encodeIfPresent(lastAxisChangeAt, forKey: .lastAxisChangeAt)
        try c.encodeIfPresent(stalenessSnoozedUntil, forKey: .stalenessSnoozedUntil)
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

    /// Fresh copy of a single contact (FS-03 fiche load) — same
    /// fresh-copy-not-live-reference contract as `getContacts()`.
    public func getContact(id: String) async throws -> VaultContact? {
        try await hydrate().contacts.first(where: { $0.id == id })
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

    // MARK: - FS-03 fiche axis edits (FCH-01)
    //
    // Distinct from `setRing`/`setEtat`/`setRessenti` above (which the
    // calibration screen still uses without a history trail) because every
    // fiche edit must ALSO append a local history event and reset the
    // FCH-05 staleness timer — behavior specific to the fiche, not to every
    // caller that ever touches these fields.

    public func setFicheRing(id: String, ring: Int) async throws {
        try await recordAxisEdit(id: id, axis: .intimite, value: CarteLabels.ringLabel[ring]) {
            $0.ring = ring
        }
    }

    public func setFicheEtat(id: String, etat: String?) async throws {
        try await recordAxisEdit(id: id, axis: .etat, value: etat) { $0.etat = etat }
    }

    public func setFicheRessenti(id: String, ressenti: String?) async throws {
        try await recordAxisEdit(id: id, axis: .ressenti, value: ressenti) { $0.ressenti = ressenti }
    }

    public func setFicheRoles(id: String, roles: [String]) async throws {
        let value = roles.isEmpty ? nil : roles.joined(separator: " · ")
        try await recordAxisEdit(id: id, axis: .roles, value: value) { $0.roles = roles }
    }

    private func recordAxisEdit(
        id: String,
        axis: FicheAxis,
        value: String?,
        mutate: (inout VaultContact) -> Void
    ) async throws {
        var data = try await hydrate()
        guard let index = data.contacts.firstIndex(where: { $0.id == id }) else {
            return
        }
        mutate(&data.contacts[index])
        let now = Date()
        data.contacts[index].lastAxisChangeAt = now
        data.contacts[index].stalenessSnoozedUntil = nil
        data.contacts[index].history.insert(
            FicheHistoryEvent(date: now, kind: .axisChanged(axis: axis.rawValue, value: value)),
            at: 0
        )
        try await persist(data)
    }

    /// FCH-05 "C'est toujours ça": re-confirms without changing any axis
    /// value, resets the staleness timer, and logs a quiet history entry
    /// (not a counter — a single qualitative feed entry, same as an axis
    /// change).
    public func reconfirmFicheStaleness(id: String) async throws {
        var data = try await hydrate()
        guard let index = data.contacts.firstIndex(where: { $0.id == id }) else {
            return
        }
        let now = Date()
        data.contacts[index].lastAxisChangeAt = now
        data.contacts[index].stalenessSnoozedUntil = nil
        data.contacts[index].history.insert(FicheHistoryEvent(date: now, kind: .reconfirmed), at: 0)
        try await persist(data)
    }

    /// FCH-05 "À revoir plus tard": dismisses quietly for 30 days. Per the
    /// spec's own acceptance criterion ("nothing is logged server-side")
    /// this deliberately does NOT append a history event — a snooze is not
    /// a relationship event worth surfacing in the feed, and nothing here
    /// ever reaches the network regardless.
    public func snoozeFicheStaleness(id: String) async throws {
        var data = try await hydrate()
        guard let index = data.contacts.firstIndex(where: { $0.id == id }) else {
            return
        }
        data.contacts[index].stalenessSnoozedUntil = Date().addingTimeInterval(FicheStaleness.snoozeInterval)
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
