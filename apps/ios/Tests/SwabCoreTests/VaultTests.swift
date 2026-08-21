/// FS-07 VLT-01 domain store tests: fresh-copy accessors, version lifecycle,
/// classification axes never touch plain storage.
import Foundation
import XCTest

@testable import SwabCore

final class VaultTests: XCTestCase {
    private func makeVault() -> Vault {
        Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
    }

    func test_VLT01_startsEmpty() async throws {
        let vault = makeVault()
        let contacts = try await vault.getContacts()
        XCTAssertEqual(contacts, [])
    }

    func test_VLT01_addContact_roundTripsThroughEncryptedStorage() async throws {
        let kv = InMemoryKeyValueStore()
        let secureStore = InMemorySecureStore()
        let vault = Vault(kv: kv, secureStore: secureStore)

        let added = try await vault.addContact(displayName: "Leïla", phoneHash: "abc123")
        XCTAssertFalse(added.id.isEmpty)
        XCTAssertEqual(added.displayName, "Leïla")

        // A second Vault instance over the same storage must decrypt and see it.
        let reopened = Vault(kv: kv, secureStore: secureStore)
        let contacts = try await reopened.getContacts()
        XCTAssertEqual(contacts.count, 1)
        XCTAssertEqual(contacts.first?.displayName, "Leïla")
        XCTAssertEqual(contacts.first?.phoneHash, "abc123")
    }

    /// VLT-01 aliasing regression: accessors must return fresh copies —
    /// mutating the returned array/struct must not mutate vault-internal state.
    func test_VLT01_getContactsReturnsFreshCopiesNotLiveReferences() async throws {
        let vault = makeVault()
        _ = try await vault.addContact(displayName: "A")

        var first = try await vault.getContacts()
        first[0].displayName = "MUTATED-LOCALLY"

        let second = try await vault.getContacts()
        XCTAssertEqual(second.first?.displayName, "A", "vault-internal state must not have been aliased")
    }

    func test_VLT01_setRing_persistsAndIsReadBack() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "B")
        try await vault.setRing(id: contact.id, ring: 1)

        let contacts = try await vault.getContacts()
        XCTAssertEqual(contacts.first?.ring, 1)
    }

    /// VLT-01: `Vault` owns the 1...4 ring invariant — rings outside
    /// `VaultRing.range` must throw rather than persist, since blobs can
    /// arrive via VLT-02 sync from a foreign/corrupt client.
    func test_VLT01_setRing_outOfRange_throwsInvalidRing() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "D")

        for outOfRange in [0, 5] {
            do {
                try await vault.setRing(id: contact.id, ring: outOfRange)
                XCTFail("expected invalidRing to throw for \(outOfRange)")
            } catch VaultError.invalidRing(let ring) {
                XCTAssertEqual(ring, outOfRange)
            }
        }

        let contacts = try await vault.getContacts()
        XCTAssertNil(contacts.first?.ring, "contact must be unchanged after a rejected ring")
    }

    /// A ring outside 1...4 in a decoded blob (foreign client, corruption)
    /// must normalize to "unplaced" rather than breaking MapGeometry's
    /// layout math, which assumes the 1...4 invariant.
    func test_VLT01_decodeContactWithOutOfRangeRing_normalizesToUnplaced() throws {
        let json = """
        {"id":"c1","displayName":"Foreign","roles":[],"ring":9}
        """
        let decoded = try JSONDecoder().decode(VaultContact.self, from: Data(json.utf8))
        XCTAssertNil(decoded.ring)
    }

    func test_VLT01_setEtatAndRessenti_optionalAndClearable() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "C")

        try await vault.setEtat(id: contact.id, etat: .available)
        try await vault.setRessenti(id: contact.id, ressenti: .positive)
        var contacts = try await vault.getContacts()
        // FCH-09: what lands in storage is the identifier, not the French copy.
        XCTAssertEqual(contacts.first?.etat, "available")
        XCTAssertEqual(contacts.first?.ressenti, "positive")
        XCTAssertEqual(contacts.first?.etatValue, .available)

        try await vault.setEtat(id: contact.id, etat: nil)
        contacts = try await vault.getContacts()
        XCTAssertNil(contacts.first?.etat)
    }

    func test_VLT01_mutatingUnknownContactId_isANoOp() async throws {
        let vault = makeVault()
        _ = try await vault.addContact(displayName: "A")
        try await vault.setRing(id: "does-not-exist", ring: 2)
        let contacts = try await vault.getContacts()
        XCTAssertNil(contacts.first?.ring)
    }

    /// Local version starts at 1 (VLT-02) and increments on every persist.
    /// Note: `getEncryptedVault()` on a never-written vault performs an
    /// implicit first persist to materialize the blob (matching the RN
    /// reference `getEncryptedVault` in `src/vault/vault.ts`), so the first
    /// observable version is 2, not 1 — this is inherited behavior, not a
    /// divergence introduced here.
    func test_VLT01_versionIncrementsOnEveryPersist() async throws {
        let vault = makeVault()

        _ = try await vault.addContact(displayName: "A")
        let (_, afterOneWrite) = try await vault.getEncryptedVault()
        XCTAssertEqual(afterOneWrite, 2)

        _ = try await vault.addContact(displayName: "B")
        let (_, afterTwoWrites) = try await vault.getEncryptedVault()
        XCTAssertEqual(afterTwoWrites, 3)
    }

    func test_VLT01_setVaultVersion_overridesLocalVersion() async throws {
        let vault = makeVault()
        _ = try await vault.addContact(displayName: "A")
        await vault.setVaultVersion(9)
        let (_, version) = try await vault.getEncryptedVault()
        XCTAssertEqual(version, 9)
    }

    /// SUG-IOS-004 / VLT-01: a blob that exists but isn't valid ciphertext
    /// must surface as `.unreadable`, never collapse to an empty vault —
    /// that's the exact silent-data-loss bug this fixes.
    func test_VLT01_corruptBlob_throwsUnreadableNotEmpty() async throws {
        let kv = InMemoryKeyValueStore()
        await kv.set("vault.blob.v1", value: "not-a-valid-ciphertext-blob")
        let vault = Vault(kv: kv, secureStore: InMemorySecureStore())

        do {
            _ = try await vault.getContacts()
            XCTFail("expected VaultError.unreadable")
        } catch VaultError.unreadable {
            // expected
        }
    }

    /// A blob that IS valid ciphertext, just encrypted under a different key
    /// than this vault instance holds (e.g. a restored Application Support
    /// backup paired with a `ThisDeviceOnly` Keychain key that didn't
    /// restore with it), must also surface as `.unreadable` rather than
    /// crash or silently return an empty vault.
    func test_VLT01_blobEncryptedUnderDifferentKey_throwsUnreadable() async throws {
        let kv = InMemoryKeyValueStore()
        let writerVault = Vault(kv: kv, secureStore: InMemorySecureStore())
        _ = try await writerVault.addContact(displayName: "A")

        // Same blob storage, but a fresh secure store — mints its own vault
        // key on first access, distinct from the one the blob was encrypted
        // under.
        let readerVault = Vault(kv: kv, secureStore: InMemorySecureStore())
        do {
            _ = try await readerVault.getContacts()
            XCTFail("expected VaultError.unreadable")
        } catch VaultError.unreadable {
            // expected
        }
    }

    /// The plain key-value store must only ever see ciphertext for the vault
    /// blob key — never a JSON fragment of contacts/rings/roles/état/ressenti.
    func test_VLT01_underlyingStorageNeverContainsPlaintextClassificationData() async throws {
        let kv = InMemoryKeyValueStore()
        let vault = Vault(kv: kv, secureStore: InMemorySecureStore())
        let contact = try await vault.addContact(displayName: "SecretName")
        try await vault.setRing(id: contact.id, ring: 3)
        try await vault.setEtat(id: contact.id, etat: .available)

        let blob = await kv.get("vault.blob.v1")
        XCTAssertNotNil(blob)
        XCTAssertFalse(blob!.contains("SecretName"))
        XCTAssertFalse(blob!.contains("disponible"), "the pre-FCH-09 display copy")
        XCTAssertFalse(blob!.contains("available"), "nor the FCH-09 identifier now stored in its place")
    }

    /// SUG-IOS-009: blob and version must land in one file write, not two —
    /// a crash between separate writes could leave version N-1 next to blob
    /// N. Spies on the underlying store to prove `persist` uses the batched
    /// path rather than two `set` calls.
    func test_VLT01_persist_writesBlobAndVersionInOneBatchedCall() async throws {
        let kv = SetCallSpyingKeyValueStore()
        let vault = Vault(kv: kv, secureStore: InMemorySecureStore())

        _ = try await vault.addContact(displayName: "A")

        let setCalls = await kv.setCalls
        let setManyCalls = await kv.setManyCalls
        XCTAssertEqual(setCalls, 0, "persist must not fall back to per-key set calls")
        XCTAssertEqual(setManyCalls.count, 1)
        XCTAssertEqual(setManyCalls.first?.keys.sorted(), ["vault.blob.v1", "vault.version.v1"])
    }
}

/// Test-only spy distinguishing a batched `setMany` write from separate
/// `set` calls — wraps `InMemoryKeyValueStore` for storage, records calls.
private actor SetCallSpyingKeyValueStore: KeyValueStore {
    private let inner = InMemoryKeyValueStore()
    private(set) var setCalls = 0
    private(set) var setManyCalls: [[String: String]] = []

    func get(_ key: String) async -> String? {
        await inner.get(key)
    }

    func set(_ key: String, value: String) async {
        setCalls += 1
        await inner.set(key, value: value)
    }

    func setMany(_ entries: [String: String]) async {
        setManyCalls.append(entries)
        for (key, value) in entries {
            await inner.set(key, value: value)
        }
    }
}
