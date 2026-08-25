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

    /// VLT-01/FCH-01: an out-of-range ring must throw before any mutation
    /// or history entry is recorded — same invariant as `setRing`.
    func test_FCH01_setFicheRing_outOfRange_throwsAndAppendsNoHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Léa")

        do {
            try await vault.setFicheRing(id: contact.id, ring: 0)
            XCTFail("expected invalidRing to throw")
        } catch VaultError.invalidRing(let ring) {
            XCTAssertEqual(ring, 0)
        }

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertNil(updated?.ring)
        XCTAssertEqual(updated?.history.count, 0)
        XCTAssertNil(updated?.lastAxisChangeAt)
    }

    func test_FCH01_setFicheEtat_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Sam")

        try await vault.setFicheEtat(id: contact.id, etat: .busy)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.etat, "busy", "FCH-09: the identifier is what persists")
        XCTAssertEqual(updated?.etatValue, .busy)
        XCTAssertEqual(updated?.history.count, 1)
        // The history feed stays a rendered fragment — display copy, on purpose.
        XCTAssertEqual(updated?.history.first?.kind, .axisChanged(axis: "etat", value: "occupé"))
    }

    func test_FCH01_setFicheRessenti_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Nour")

        try await vault.setFicheRessenti(id: contact.id, ressenti: .ambivalent)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.ressenti, "ambivalent")
        XCTAssertEqual(updated?.ressentiValue, .ambivalent)
        XCTAssertEqual(updated?.history.count, 1)
    }

    func test_FCH01_setFicheRoles_persistsAndAppendsHistory() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Ali")

        try await vault.setFicheRoles(id: contact.id, roles: [.family, .colleague])

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.roles, ["family", "colleague"], "FCH-09: identifiers persist…")
        XCTAssertEqual(updated?.roleValues, [.family, .colleague])
        XCTAssertEqual(updated?.history.count, 1)
        if case .axisChanged(let axis, let value) = updated?.history.first?.kind {
            XCTAssertEqual(axis, FicheAxis.roles.rawValue)
            XCTAssertEqual(value, "famille · collègue", "…while the history feed stays display copy")
        } else {
            XCTFail("expected an axisChanged history event")
        }
    }

    /// FCH-04: newest first — multiple edits insert at the front, not the back.
    func test_FCH04_historyFeed_newestFirst() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Yara")

        try await vault.setFicheRing(id: contact.id, ring: 1)
        try await vault.setFicheEtat(id: contact.id, etat: .available)
        try await vault.setFicheRessenti(id: contact.id, ressenti: .positive)

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

        try await vault.setFicheEtat(id: contact.id, etat: .available)
        updated = try await vault.getContact(id: contact.id)
        XCTAssertNil(updated?.stalenessSnoozedUntil, "an axis edit must clear an active snooze")
    }

    /// FCH-05 "C'est toujours ça": resets the timer and logs a quiet
    /// reconfirmed entry without changing any axis value.
    func test_FCH05_reconfirmStaleness_resetsTimerAndLogsHistoryWithoutChangingAxes() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Karim")
        try await vault.setFicheEtat(id: contact.id, etat: .busy)

        try await vault.reconfirmFicheStaleness(id: contact.id)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.etat, "busy", "reconfirm must not change the axis value")
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
        try await vault.setFicheEtat(id: contact.id, etat: .available)
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
        try await vault.setFicheEtat(id: contact.id, etat: .away)
        try await vault.setFicheRessenti(id: contact.id, ressenti: .ambivalent)
        try await vault.setFicheRoles(id: contact.id, roles: [.partner])

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.ring, 3)
        XCTAssertEqual(updated?.etat, "away")
        XCTAssertEqual(updated?.ressenti, "ambivalent")
        XCTAssertEqual(updated?.roles, ["partner"])
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
        try await vault.setFicheEtat(id: "missing", etat: .available)
        try await vault.setFicheRessenti(id: "missing", ressenti: .positive)
        try await vault.setFicheRoles(id: "missing", roles: [.family])
        try await vault.reconfirmFicheStaleness(id: "missing")
        try await vault.snoozeFicheStaleness(id: "missing")

        let contacts = try await vault.getContacts()
        XCTAssertEqual(contacts.count, 1)
        XCTAssertEqual(contacts.first?.history.count, 0)
    }

    /// FCH-04/VLT-03: history older than the 12-month display window is
    /// pruned from storage on the next write, not just filtered at read
    /// time — otherwise the blob grows unbounded against the server's 1 MB
    /// quota (SUG-IOS-007).
    ///
    /// Seeds a corroborating six-month-old event alongside the stale one so
    /// the issue #113 clock-skew guard below sees a recent enough anchor and
    /// lets this ordinary prune proceed — a lone 13-month-old event with no
    /// other anchor is deliberately ambiguous (see
    /// `test_FCH04_fastDeviceClock_doesNotDeleteRealHistory`) and is not what
    /// this test is about.
    func test_FCH04_historyOlderThanTwelveMonths_isPrunedOnNextWrite() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Léa")
        let thirteenMonthsAgo = Calendar.current.date(byAdding: .month, value: -13, to: Date())!
        let sixMonthsAgo = Calendar.current.date(byAdding: .month, value: -6, to: Date())!
        try await vault.setTestHistory(id: contact.id, history: [
            FicheHistoryEvent(date: sixMonthsAgo, kind: .reconfirmed),
            FicheHistoryEvent(date: thirteenMonthsAgo, kind: .reconfirmed),
        ])

        try await vault.setFicheEtat(id: contact.id, etat: .available)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(
            updated?.history.count, 2,
            "the 13-month-old event must be pruned; the 6-month one and the new edit remain"
        )
        if case .axisChanged = updated?.history.first?.kind {
            // expected — the fresh edit is newest-first
        } else {
            XCTFail("expected the surviving newest event to be the new axisChanged entry")
        }
    }

    /// The mirror case: an event just inside the 12-month window survives
    /// an unrelated write.
    func test_FCH04_historyWithinTwelveMonths_isKeptOnWrite() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Sam")
        let elevenMonthsAgo = Calendar.current.date(byAdding: .month, value: -11, to: Date())!
        let recentEnough = FicheHistoryEvent(date: elevenMonthsAgo, kind: .reconfirmed)
        try await vault.setTestHistory(id: contact.id, history: [recentEnough])

        try await vault.setFicheEtat(id: contact.id, etat: .available)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.history.count, 2, "the 11-month-old event must survive the prune")
    }

    // ---- issue #113 / FCH-04: clock-skew guard on the write-time prune ----
    //
    // `prunedHistory` used to compute its cutoff straight off the caller's
    // `now` (`Date()` at the call site), so a device clock running years
    // fast made one ordinary edit compute a cutoff in the FUTURE and delete
    // every stored event for that contact. `persist` writes that
    // immediately and `VaultSync` pushes the whole blob (re-pushed unmerged
    // on a 409 conflict), so the deletion reached the server — the VLT-05
    // restore source. Real data loss, not a display glitch.
    //
    // The fix corroborates `now` against the newest event already stored
    // for THIS contact (per-contact, not vault-wide — see
    // `apps/ios/CHANGELOG.md` for why): if `now` is further ahead of that
    // than the whole retention window, a clock jump and a year-long dormant
    // contact are indistinguishable, and in that doubt the write skips the
    // prune (appends without deleting) rather than trust a possibly-wrong
    // clock. `testRecordAxisEdit`/`testReconfirmFicheStaleness` are
    // test-only seams (`@testable`) that inject `now` directly — production
    // call sites always derive it from `Date()`.

    func test_FCH04_fastDeviceClock_doesNotDeleteRealHistory() async throws {
        let vault = makeVault()
        let a = try await vault.addContact(displayName: "A")
        let b = try await vault.addContact(displayName: "B")
        let realNow = Date()
        try await vault.setTestHistory(id: a.id, history: [FicheHistoryEvent(date: realNow, kind: .reconfirmed)])
        try await vault.setTestHistory(id: b.id, history: [FicheHistoryEvent(date: realNow, kind: .reconfirmed)])

        // Clock jumps four years forward, then one chip tap on A only.
        let skewed = Calendar.current.date(byAdding: .year, value: 4, to: realNow)!
        try await vault.testRecordAxisEdit(id: a.id, now: skewed)

        let updatedA = try await vault.getContact(id: a.id)
        XCTAssertEqual(updatedA?.history.count, 2, "A's real event must survive a skewed write")
        let updatedB = try await vault.getContact(id: b.id)
        XCTAssertEqual(updatedB?.history.count, 1, "an untouched contact must not lose history either")
    }

    func test_FCH04_storedFutureDatedEvent_doesNotPoisonLaterPruning() async throws {
        // The mirror: once a skewed event IS stored, a later ORDINARY write
        // (sane clock) must still use ITS OWN `now` as the cutoff basis, not
        // the bogus future timestamp already sitting in history — otherwise
        // the poisoned value becomes the new anchor and wipes everything on
        // the very next normal edit.
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Nadia")
        let realNow = Date()
        let bogusFuture = Calendar.current.date(byAdding: .year, value: 4, to: realNow)!
        try await vault.setTestHistory(id: contact.id, history: [
            FicheHistoryEvent(date: bogusFuture, kind: .reconfirmed),
            FicheHistoryEvent(date: realNow, kind: .reconfirmed),
        ])

        let ordinaryNow = realNow.addingTimeInterval(1_000)
        try await vault.testRecordAxisEdit(id: contact.id, now: ordinaryNow)

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(
            updated?.history.count, 3,
            "the real event must survive alongside the bogus future one and the new edit"
        )
    }

    /// VLT-03: pruning keeps the blob bounded under sustained editing. The
    /// 50 back-dated events seeded first are what give the `== 100`
    /// assertion teeth: without pruning the feed would hold 150, so this
    /// fails if the mechanism regresses. (Seeding matters — a bare
    /// 100-edit loop asserts only that the loop ran 100 times, and passes
    /// with pruning disabled.)
    func test_VLT03_hundredEdits_historyStaysBounded() async throws {
        let vault = makeVault()
        let contact = try await vault.addContact(displayName: "Yara")
        let thirteenMonthsAgo = Calendar.current.date(byAdding: .month, value: -13, to: Date())!
        try await vault.setTestHistory(
            id: contact.id,
            history: (0..<50).map { _ in FicheHistoryEvent(date: thirteenMonthsAgo, kind: .reconfirmed) }
        )

        for _ in 0..<100 {
            try await vault.reconfirmFicheStaleness(id: contact.id)
        }

        let updated = try await vault.getContact(id: contact.id)
        XCTAssertEqual(updated?.history.count, 100, "the 50 stale events must be pruned; only the 100 fresh ones remain")
        let encoded = try JSONEncoder().encode(updated?.history)
        XCTAssertLessThan(encoded.count, 50_000, "sanity ceiling on the serialized feed")
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
