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

public typealias IntimacyRing = Int  // 1...4; validated by Vault's setters (VaultRing).

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

    // MARK: - FCH-09 typed reads
    //
    // `etat`/`ressenti`/`roles` hold the STORED tokens (identifiers, or an
    // unrecognised token preserved verbatim). Everything that renders or
    // branches on a value goes through these instead, so no call site ever
    // compares against French copy again.

    public var etatValue: Etat? { etat.flatMap(Etat.parse(stored:)) }

    public var ressentiValue: Ressenti? { ressenti.flatMap(Ressenti.parse(stored:)) }

    /// Unrecognised tokens are skipped for display but remain in `roles`.
    public var roleValues: [RoleContexte] { roles.compactMap(RoleContexte.parse(stored:)) }

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
        let decodedRing = try c.decodeIfPresent(Int.self, forKey: .ring)
        // Defensive normalize: an out-of-range ring from a foreign/corrupt
        // blob (VLT-02 sync, hand-edited fixture) decodes as "unplaced"
        // rather than breaking MapGeometry's 1...4 layout math. Never
        // rewrites storage here — only affects what a later legitimate
        // persist writes.
        ring = decodedRing.flatMap { VaultRing.range.contains($0) ? $0 : nil }
        // FCH-09 dual-read: a blob written before 2026-08-16 carries French
        // display copy ("occupé"), a newer one carries identifiers ("busy").
        // Both decode; the next persist writes identifiers. A token in
        // neither vocabulary — e.g. the retired `douceur` in
        // `vault-test-vectors.json` — is kept verbatim, so nothing is ever
        // dropped by a read.
        roles = (try c.decodeIfPresent([String].self, forKey: .roles) ?? [])
            .map(RoleContexte.normalize(stored:))
        etat = try c.decodeIfPresent(String.self, forKey: .etat).map(Etat.normalize(stored:))
        ressenti = try c.decodeIfPresent(String.self, forKey: .ressenti)
            .map(Ressenti.normalize(stored:))
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
    case invalidRing(Int)
    /// SUG-IOS-004 / VLT-01: the blob exists but could not be decrypted or
    /// decoded (bad/foreign key, tampered/corrupted bytes, garbage JSON).
    /// Distinct from "no blob at all" (which hydrates to an empty vault) —
    /// callers must not collapse the two into the same "empty" UI state,
    /// since that was silent data loss (MAP-06's calm empty copy is only
    /// honest for a genuinely empty vault).
    case unreadable

    /// G3: fixed, privacy-safe code for `ErrorReporter` (see
    /// `Observability/ErrorReporter.swift`). Deliberately never derived from
    /// `localizedDescription` — decrypt/decode failures crossing this
    /// boundary (corrupt blob, foreign-client payload) surface as raw
    /// `CryptoKit`/`DecodingError` values, not `VaultError`, and their
    /// descriptions are not privacy-audited.
    public static func reportCode(for error: Error) -> String {
        switch error {
        case VaultError.blobUnavailable: return "blobUnavailable"
        case VaultError.invalidRing: return "invalidRing"
        case VaultError.unreadable: return "unreadable"
        default: return "unreadable"
        }
    }
}

public actor Vault {
    private static let blobKey = "vault.blob.v1"
    private static let versionKey = "vault.version.v1"

    private let kv: KeyValueStore
    private let keyStore: VaultKeyStore
    private var cache: VaultData?
    private var version = 1
    /// VLT-04: fired after every persist that changes user data, so a sync
    /// scheduler can debounce the write burst. Deliberately a bare closure
    /// and not a `VaultSync`/`SyncScheduler` reference — this module must
    /// stay ignorant of the network (the same MAP-05 layering that
    /// `CarteOfflineInvariantTests` polices from the other side).
    private var onPersist: (@Sendable () -> Void)?

    public init(kv: KeyValueStore, secureStore: SecureStore) {
        self.kv = kv
        self.keyStore = VaultKeyStore(store: secureStore)
    }

    /// Installed once by the composition root (`App/SwabApp.swift`).
    public func setOnPersist(_ handler: (@Sendable () -> Void)?) {
        onPersist = handler
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
        // SUG-IOS-004: decrypt+decode failures are reported as `.unreadable`,
        // never left to bubble up as a raw CryptoKit/DecodingError that a
        // caller's `try?`/`?? []` collapses into "empty, nothing wrong here".
        let data: VaultData
        do {
            let plaintext = try VaultCrypto.decrypt(blobBase64: blob, key: key)
            data = try JSONDecoder().decode(VaultData.self, from: Data(plaintext.utf8))
        } catch {
            throw VaultError.unreadable
        }
        cache = data
        return data
    }

    /// `notify: false` is for persists that are not user writes — see
    /// `getEncryptedVault()`.
    private func persist(_ data: VaultData, notify: Bool = true) async throws {
        let key = try keyStore.getOrCreateKey()
        version += 1
        let json = try JSONEncoder().encode(data)
        let plaintext = String(decoding: json, as: UTF8.self)
        let blob = try VaultCrypto.encrypt(plaintext: plaintext, key: key)
        // SUG-IOS-009: one batched write — two separate `set` calls could
        // leave a crash between them with the new blob but the old version.
        await kv.setMany([Self.blobKey: blob, Self.versionKey: String(version)])
        cache = data
        if notify {
            onPersist?()
        }
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
        guard VaultRing.range.contains(ring) else { throw VaultError.invalidRing(ring) }
        try await mutateContact(id: id) { $0.ring = ring }
    }

    /// Test-only seam (SUG-IOS-007): every production write path stamps
    /// history events with `Date()`, so tests need a way to seed a
    /// back-dated event to exercise the 12-month prune. Not `public` — only
    /// reachable via `@testable import SwabCore`. Bypasses pruning itself so
    /// tests can assert on the *next* write's behavior.
    func setTestHistory(id: String, history: [FicheHistoryEvent]) async throws {
        try await mutateContact(id: id) { $0.history = history }
    }

    // FCH-09: the setters take the typed value, not a String, so writing
    // French copy into the vault is a compile error rather than a review catch.

    public func setEtat(id: String, etat: Etat?) async throws {
        try await mutateContact(id: id) { $0.etat = etat?.rawValue }
    }

    public func setRessenti(id: String, ressenti: Ressenti?) async throws {
        try await mutateContact(id: id) { $0.ressenti = ressenti?.rawValue }
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
        guard VaultRing.range.contains(ring) else { throw VaultError.invalidRing(ring) }
        try await recordAxisEdit(id: id, axis: .intimite, value: CarteLabels.ringLabel[ring]) {
            $0.ring = ring
        }
    }

    // The history event's `value` stays the DISPLAY label, unchanged by
    // FCH-09: it is a rendered sentence fragment for the feed, and FCH-04
    // hands event creation to the server at ADR-001 stage 2, which will
    // model it properly. Re-encoding it here would be thrown away.

    public func setFicheEtat(id: String, etat: Etat?) async throws {
        try await recordAxisEdit(id: id, axis: .etat, value: etat?.label) { $0.etat = etat?.rawValue }
    }

    public func setFicheRessenti(id: String, ressenti: Ressenti?) async throws {
        try await recordAxisEdit(id: id, axis: .ressenti, value: ressenti?.label) {
            $0.ressenti = ressenti?.rawValue
        }
    }

    public func setFicheRoles(id: String, roles: [RoleContexte]) async throws {
        let value = roles.isEmpty ? nil : roles.map(\.label).joined(separator: " · ")
        try await recordAxisEdit(id: id, axis: .roles, value: value) {
            $0.roles = roles.map(\.rawValue)
        }
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
        data.contacts[index].history = prunedHistory(data.contacts[index].history, now: now)
        try await persist(data)
    }

    /// SUG-IOS-007/VLT-03: FCH-04 only ever *displays* 12 months
    /// (`FicheViewModel.recentHistory` filters at read time) but storage
    /// retained everything forever, which will eventually blow the
    /// server's ≤1 MB vault-blob quota. Pruning here, inside the same
    /// mutate-then-persist transaction as the write that triggered it,
    /// keeps the two in sync without a separate read-modify-write pass.
    /// Read-time filtering in `FicheViewModel` stays as-is — it remains the
    /// display source of truth for legacy blobs and clock-skew edge cases.
    private func prunedHistory(_ history: [FicheHistoryEvent], now: Date) -> [FicheHistoryEvent] {
        let cutoff = Calendar.current.date(byAdding: .month, value: -12, to: now) ?? .distantPast
        return history.filter { $0.date >= cutoff }
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
        data.contacts[index].history = prunedHistory(data.contacts[index].history, now: now)
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
            // `notify: false` — materialising the blob so a push has
            // something to send is not a user write. Announcing it would
            // re-arm the very debounce that triggered this sync (VLT-04).
            try await persist(data, notify: false)
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
