/// MAP-05 — carte state: loads from the on-device vault ONLY. This file
/// deliberately imports nothing beyond `Observation`/`SwabCore` — no
/// networking import exists here, by construction. `CarteOfflineInvariantTests`
/// (SwabCoreTests) scans this file's source text as a structural guard
/// against a future regression, mirroring the RN reference's own MAP-05
/// test that scans for API imports. (Deliberately not naming the specific
/// banned symbols in this comment — the scanner matches on them literally.)
import Observation
import SwabCore

@MainActor
@Observable
public final class CarteViewModel {
    /// SUG-IOS-004 / VLT-01 / MAP-06: distinguishes "no data yet"/"genuinely
    /// no contacts" from "data exists but couldn't be read" — the two must
    /// never render the same calm-empty copy (that was silent data loss).
    public enum LoadState: Equatable {
        case loading, loaded, unreadable
    }

    public private(set) var contacts: [VaultContact] = []
    public private(set) var loadState: LoadState = .loading
    public var listMode = false
    public var legendOpen = false
    public var selected: VaultContact?

    private let vault: Vault
    private let reporter: ErrorReporter

    public init(vault: Vault, reporter: ErrorReporter = NoopErrorReporter()) {
        self.vault = vault
        self.reporter = reporter
    }

    public var unplaced: [VaultContact] {
        contacts.filter { $0.ring == nil }
    }

    public var placed: [VaultContact] {
        contacts.filter { $0.ring != nil }
    }

    /// MAP-05: zero network, offline-first. Called on appear and whenever
    /// the app returns to foreground, so an FS-03 re-tag is reflected with
    /// an animated move rather than requiring a relaunch.
    public func refresh() async {
        do {
            contacts = try await vault.getContacts()
            loadState = .loaded
        } catch {
            reporter.report(
                ReportedError(domain: "carte.vault", operation: "refresh", errorDescription: VaultError.reportCode(for: error))
            )
            contacts = []
            loadState = .unreadable
        }
    }

    public func select(_ contact: VaultContact) {
        selected = contact
    }

    public func closeSheet() {
        selected = nil
    }

    public func toggleLegend() {
        legendOpen.toggle()
    }

    /// FS-03 seam: constructs the fiche's view model without exposing this
    /// view model's private `vault` reference — `CarteView` calls this when
    /// « Ouvrir la fiche » is tapped instead of holding its own `Vault`.
    public func makeFicheViewModel(for contact: VaultContact) -> FicheViewModel {
        FicheViewModel(vault: vault, contact: contact, reporter: reporter)
    }
}
