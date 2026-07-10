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
    public private(set) var contacts: [VaultContact] = []
    public var listMode = false
    public var legendOpen = false
    public var selected: VaultContact?

    private let vault: Vault

    public init(vault: Vault) {
        self.vault = vault
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
        contacts = (try? await vault.getContacts()) ?? []
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
}
