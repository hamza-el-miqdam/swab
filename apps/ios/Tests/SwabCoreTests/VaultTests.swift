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

    func test_VLT01_setEtatAndRessenti_optionalAndClearable() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "C")

        try await vault.setEtat(id: contact.id, etat: "disponible")
        try await vault.setRessenti(id: contact.id, ressenti: "léger")
        var contacts = try await vault.getContacts()
        XCTAssertEqual(contacts.first?.etat, "disponible")
        XCTAssertEqual(contacts.first?.ressenti, "léger")

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

    /// The plain key-value store must only ever see ciphertext for the vault
    /// blob key — never a JSON fragment of contacts/rings/roles/état/ressenti.
    func test_VLT01_underlyingStorageNeverContainsPlaintextClassificationData() async throws {
        let kv = InMemoryKeyValueStore()
        let vault = Vault(kv: kv, secureStore: InMemorySecureStore())
        let contact = try await vault.addContact(displayName: "SecretName")
        try await vault.setRing(id: contact.id, ring: 3)
        try await vault.setEtat(id: contact.id, etat: "disponible")

        let blob = await kv.get("vault.blob.v1")
        XCTAssertNotNil(blob)
        XCTAssertFalse(blob!.contains("SecretName"))
        XCTAssertFalse(blob!.contains("disponible"))
    }
}
