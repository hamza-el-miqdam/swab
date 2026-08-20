/// G3 (`agents/_global-directives.md`, Observability): `ErrorReporter` is
/// precisely where a privacy leak would be easiest to introduce — every
/// reported field must carry error IDENTITY ONLY, never classification
/// vocabulary. Same string-list technique as
/// `Tests/SwabCoreTests/FichePrivacyInvariantTests.swift`, applied to the
/// reporter instead of the network payload.
///
/// Lives in `SwabUITests`, not `SwabCoreTests`: the reporting itself happens
/// at the view-model boundary (SwabUI) per SUG-IOS-005's plan — "Vault-layer
/// internals stay throwing; only the VM boundary reports" — so this needs
/// `CarteViewModel`/`DoneViewModel`, which `SwabCoreTests` cannot see.
import XCTest
@testable import SwabUI
import SwabCore

/// Thread-safe recording double — `ErrorReporter.report` is a plain
/// synchronous call, so a lock-backed `@unchecked Sendable` class matches
/// `InMemorySecureStore`'s existing idiom rather than an actor.
private final class RecordingErrorReporter: ErrorReporter, @unchecked Sendable {
    private let lock = NSLock()
    private var _events: [ReportedError] = []

    var events: [ReportedError] {
        lock.lock()
        defer { lock.unlock() }
        return _events
    }

    func report(_ event: ReportedError) {
        lock.lock()
        defer { lock.unlock() }
        _events.append(event)
    }
}

/// `VaultSyncApi` double that always conflicts — `VaultSync.sync()` retries
/// once (VLT-02) and then throws `VaultSyncError.conflictPersisted`.
private actor AlwaysConflictVaultSyncApi: VaultSyncApi {
    func pushVault(blob: String, version: Int) async throws -> VaultPushResult {
        .conflict
    }

    func getVault() async throws -> EncryptedVaultBlob? {
        nil
    }
}

@MainActor
final class ErrorReporterPrivacyTests: XCTestCase {
    private static let ringLabels: [String] = [1, 2, 3, 4].compactMap { CarteLabels.ringLabel[$0] }
    private static let axisLabels: [String] =
        FicheVocabulary.etatLabels + FicheVocabulary.ressentiLabels + FicheVocabulary.roleLabels
    private static let axisIdentifiers: [String] =
        Etat.identifiers + Ressenti.identifiers + RoleContexte.identifiers
    private static let classificationStrings: [String] =
        ringLabels + axisLabels + axisIdentifiers + ["SecretDisplayName"]

    private func assertNoLeak(_ events: [ReportedError]) {
        let haystacks = events.flatMap { [$0.domain, $0.operation, $0.errorDescription] }
        for plaintext in Self.classificationStrings {
            for haystack in haystacks {
                XCTAssertFalse(
                    haystack.contains(plaintext),
                    "classification string '\(plaintext)' leaked into a reported error ('\(haystack)')"
                )
            }
        }
    }

    /// Two real failure paths through `ErrorReporter`: a corrupt-blob decrypt
    /// failure (`CarteViewModel.refresh()`) and a persisted sync conflict
    /// (`DoneViewModel.finish()`). Neither `ReportedError`'s `domain`,
    /// `operation`, nor `errorDescription` may contain any classification
    /// string — the whole point of the fixed-code mapping in
    /// `VaultError.reportCode`/`VaultSyncError.reportCode`.
    func test_G3_reportedErrors_neverContainClassificationVocabulary() async throws {
        let reporter = RecordingErrorReporter()

        // 1. Corrupt-blob decrypt failure through the real vault boundary.
        let kv = InMemoryKeyValueStore()
        let secureStore = InMemorySecureStore()
        let seedVault = Vault(kv: kv, secureStore: secureStore)
        let contact = try await seedVault.addContact(displayName: "SecretDisplayName")
        try await seedVault.setFicheRing(id: contact.id, ring: 2)
        try await seedVault.setFicheEtat(id: contact.id, etat: .available)
        try await seedVault.setFicheRessenti(id: contact.id, ressenti: .positive)
        try await seedVault.setFicheRoles(id: contact.id, roles: RoleContexte.allCases)

        // Overwrite the ciphertext in place with an undecryptable value — the
        // same class of failure a foreign/corrupt sync payload produces.
        await kv.set("vault.blob.v1", value: "not-valid-ciphertext")
        let corruptVault = Vault(kv: kv, secureStore: secureStore)
        let carteVM = CarteViewModel(vault: corruptVault, reporter: reporter)
        await carteVM.refresh()

        // 2. Persisted sync conflict through the real VaultSync retry path.
        let syncVault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        _ = try await syncVault.addContact(displayName: "SecretDisplayName")
        let vaultSync = VaultSync(vault: syncVault, api: AlwaysConflictVaultSyncApi())
        let onboarding = OnboardingStateStore(kv: InMemoryKeyValueStore())
        let doneVM = DoneViewModel(onboarding: onboarding, vaultSync: vaultSync, reporter: reporter)
        await doneVM.finish()

        let events = reporter.events
        XCTAssertGreaterThanOrEqual(events.count, 2, "expected a reported event from each forced failure")
        assertNoLeak(events)
    }

    func test_G3_syncFailure_isReportedOnce() async throws {
        let reporter = RecordingErrorReporter()
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        _ = try await vault.addContact(displayName: "A")
        let vaultSync = VaultSync(vault: vault, api: AlwaysConflictVaultSyncApi())
        let onboarding = OnboardingStateStore(kv: InMemoryKeyValueStore())

        let doneVM = DoneViewModel(onboarding: onboarding, vaultSync: vaultSync, reporter: reporter)
        await doneVM.finish()

        let events = reporter.events
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.domain, "vault.sync")
    }
}
