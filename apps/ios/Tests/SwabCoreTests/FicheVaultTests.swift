/// FCH-01/04/05/08 — the vault's fiche-specific write path: every axis
/// edit writes immediately (optimistic, offline-capable — no network
/// import exists anywhere in `Vault.swift`'s fiche methods) and appends a
/// local history event; staleness reconfirm/snooze; pending-contact fiche
/// support.
import Foundation
import XCTest

@testable import SwabCore

final class FicheVaultTests: XCTestCase {
    private func makeVault() -> Vault {
        Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
    }

    func test_FCH01_setFicheRing_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Léa")

        try await vault.setFicheRing(id: contact.id, ring: 2)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.ring, 2)
        XCTAssertEqual(updated?.history.count, 1)
        XCTAssertNotNil(updated?.lastAxisChangeAt)
        if case .axisChanged(let axis, let value) = updated?.history.first?.kind {
            XCTAssertEqual(axis, FicheAxis.intimite.rawValue)
            XCTAssertEqual(value, CarteLabels.ringLabel[2])
        } else {
            XCTFail("expected an axisChanged history event")
        }
    }

    func test_FCH01_setFicheEtat_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Sam")

        try await vault.setFicheEtat(id: contact.id, etat: "occupé")

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.etat, "occupé")
        XCTAssertEqual(updated?.history.count, 1)
    }

    func test_FCH01_setFicheRessenti_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Nour")

        try await vault.setFicheRessenti(id: contact.id, ressenti: "en pause")

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.ressenti, "en pause")
        XCTAssertEqual(updated?.history.count, 1)
    }

    func test_FCH01_setFicheRoles_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Ali")

        try await vault.setFicheRoles(id: contact.id, roles: ["Famille", "Travail"])

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.roles, ["Famille", "Travail"])
        XCTAssertEqual(updated?.history.count, 1)
        if case .axisChanged(let axis, let value) = updated?.history.first?.kind {
            XCTAssertEqual(axis, FicheAxis.roles.rawValue)
            XCTAssertEqual(value, "Famille · Travail")
        } else {
            XCTFail("expected an axisChanged history event")
        }
    }

    /// FCH-04: newest first — multiple edits insert at the front, not the back.
    func test_FCH04_historyFeed_newestFirst() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Yara")

        try await vault.setFicheRing(id: contact.id, ring: 1)
        try await vault.setFicheEtat(id: contact.id, etat: "disponible")
        try await vault.setFicheRessenti(id: contact.id, ressenti: "léger")

        let updated = try await vault.getContact(id: contact.id)
        let kinds = updated?.history.map(\.kind)
        guard case .axisChanged(let firstAxis, _) = kinds?[0],
              case .axisChanged(let lastAxis, _) = kinds?[2] else {
            return XCTFail("expected three axisChanged events")
        }
        XCTAssertEqual(firstAxis, FicheAxis.ressenti.rawValue, "most recent edit must be first")
        XCTAssertEqual(lastAxis, FicheAxis.intimite.rawValue, "earliest edit must be last")
    }

    /// FCH-05: an axis edit resets the staleness timer and clears any snooze.
    func test_FCH05_axisEditResetsSnooze() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Nadia")

        try await vault.snoozeFicheStaleness(id: contact.id)
        var updated = try await vault.getContact(id: contact.id)
        XCTAssertNotNil(updated?.stalenessSnoozedUntil)

        try await vault.setFicheEtat(id: contact.id, etat: "disponible")
        updated = try await vault.getContact(id: contact.id)
        XCTAssertNil(updated?.stalenessSnoozedUntil, "an axis edit must clear an active snooze")
    }

    /// FCH-05 "C'est toujours ça": resets the timer and logs a quiet
    /// reconfirmed entry without changing any axis value.
    func test_FCH05_reconfirmStaleness_resetsTimerAndLogsHistoryWithoutChangingAxes() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Karim")
        try await vault.setFicheEtat(id: contact.id, etat: "occupé")

        try await vault.reconfirmFicheStaleness(id: contact.id)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.etat, "occupé", "reconfirm must not change the axis value")
        XCTAssertEqual(updated?.history.count, 2)
        if case .reconfirmed = updated?.history.first?.kind {
            // expected
        } else {
            XCTFail("expected the most recent history event to be .reconfirmed")
        }
        XCTAssertNotNil(updated?.lastAxisChangeAt)
    }

    /// FCH-05 "À revoir plus tard": snoozes ~30 days out and — per the
    /// spec's "nothing is logged server-side" acceptance criterion — this
    /// client also doesn't add a history feed entry for the snooze itself.
    func test_FCH05_snoozeStaleness_setsThirtyDayWindowAndDoesNotLogHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Omar")
        try await vault.setFicheEtat(id: contact.id, etat: "disponible")
        let historyCountBeforeSnooze = try await vault.getContact(id: contact.id)?.history.count

        try await vault.snoozeFicheStaleness(id: contact.id)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.history.count, historyCountBeforeSnooze, "snooze must not append a history event")
        guard let snoozedUntil = updated?.stalenessSnoozedUntil else {
            return XCTFail("expected stalenessSnoozedUntil to be set")
        }
        let expected = Date().addingTimeInterval(FicheStaleness.snoozeInterval)
        XCTAssertEqual(snoozedUntil.timeIntervalSince1970, expected.timeIntervalSince1970, accuracy: 5)
    }

    /// FCH-08: a pending contact (no `targetId`) is fully editable, same as
    /// any joined contact.
    func test_FCH08_pendingContact_axesAreFullyEditable() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Invité")
        XCTAssertNil(contact.targetId, "sanity check: freshly added contacts are pending by default")

        try await vault.setFicheRing(id: contact.id, ring: 3)
        try await vault.setFicheEtat(id: contact.id, etat: "ailleurs")
        try await vault.setFicheRessenti(id: contact.id, ressenti: "précieux")
        try await vault.setFicheRoles(id: contact.id, roles: ["Amitié"])

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.ring, 3)
        XCTAssertEqual(updated?.etat, "ailleurs")
        XCTAssertEqual(updated?.ressenti, "précieux")
        XCTAssertEqual(updated?.roles, ["Amitié"])
        XCTAssertNil(updated?.targetId, "still pending — editing axes must not silently mark it joined")
        XCTAssertFalse(FicheEligibility.isEnvieActive(targetId: updated?.targetId))
    }

    /// VLT-01 fresh-copy contract extended to the new single-contact getter.
    func test_getContact_returnsFreshCopyNotLiveReference() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Zoé")

        var fetched = try await vault.getContact(id: contact.id)
        fetched?.displayName = "MUTATED-LOCALLY"

        let refetched = try await vault.getContact(id: contact.id)
        XCTAssertEqual(refetched?.displayName, "Zoé")
    }

    func test_getContact_unknownId_returnsNil() async throws {
        let vault = makeVault()
        let result = try await vault.getContact(id: "does-not-exist")
        XCTAssertNil(result)
    }

    /// Mutating an unknown id must be a no-op for every fiche method, same
    /// contract as the existing `setRing`/`setEtat` methods.
    func test_ficheMethods_unknownContactId_areNoOps() async throws {
        let vault = makeVault()
        _ = try await vault.addContact(displayName: "A")

        try await vault.setFicheRing(id: "missing", ring: 1)
        try await vault.setFicheEtat(id: "missing", etat: "disponible")
        try await vault.setFicheRessenti(id: "missing", ressenti: "léger")
        try await vault.setFicheRoles(id: "missing", roles: ["Famille"])
        try await vault.reconfirmFicheStaleness(id: "missing")
        try await vault.snoozeFicheStaleness(id: "missing")

        let contacts = try await vault.getContacts()
        XCTAssertEqual(contacts.count, 1)
        XCTAssertEqual(contacts.first?.history.count, 0)
    }

    /// Backward compatibility: a Wave 1/2 blob shape (no FS-03 fields at
    /// all) must decode with sensible defaults rather than throwing.
    func test_backwardCompat_legacyContactWithoutFicheFields_decodesWithDefaults() throws {
        let legacyJSON = """
        {"id":"c1","displayName":"Old","roles":[]}
        """
        let decoded = try JSONDecoder().decode(VaultContact.self, from: Data(legacyJSON.utf8))
        XCTAssertEqual(decoded.id, "c1")
        XCTAssertEqual(decoded.history, [])
        XCTAssertNil(decoded.targetId)
        XCTAssertNil(decoded.lastAxisChangeAt)
        XCTAssertNil(decoded.stalenessSnoozedUntil)
    }
}
