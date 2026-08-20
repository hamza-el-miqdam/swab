/// FS-03 — per-relation detail/editing state. Same MVVM shape as
/// `CarteViewModel`: `@Observable`, talks only to the vault (FCH-01's
/// "optimistic, offline-capable" writes — every setter mutates the vault
/// directly, no queue/pending-state needed since the vault itself is the
/// local source of truth and `VaultSync` reconciles in the background).
import Foundation
import Observation
import SwabCore

@MainActor
@Observable
public final class FicheViewModel {
    public private(set) var contact: VaultContact

    private let vault: Vault
    private let reporter: ErrorReporter

    public init(vault: Vault, contact: VaultContact, reporter: ErrorReporter = NoopErrorReporter()) {
        self.vault = vault
        self.contact = contact
        self.reporter = reporter
    }

    /// G3: every `try?` swallow below reports through here first — domain
    /// `"fiche.vault"`, a fixed vault error code (never `localizedDescription`).
    private func report(_ operation: String, _ error: Error) {
        reporter.report(ReportedError(domain: "fiche.vault", operation: operation, errorDescription: VaultError.reportCode(for: error)))
    }

    /// FCH-08: envie eligibility — inactive until the pending contact link
    /// resolves to a joined user.
    public var isEnvieActive: Bool {
        FicheEligibility.isEnvieActive(targetId: contact.targetId)
    }

    /// FCH-04: history feed, 12 months, newest first, sourced from the
    /// vault only.
    public var recentHistory: [FicheHistoryEvent] {
        let cutoff = Calendar.current.date(byAdding: .month, value: -12, to: Date()) ?? .distantPast
        return contact.history
            .filter { $0.date >= cutoff }
            .sorted { $0.date > $1.date }
    }

    /// FCH-05: whether to render the discreet staleness prompt right now.
    public var shouldShowStalenessNudge: Bool {
        FicheStaleness.shouldShowNudge(
            lastAxisChangeAt: contact.lastAxisChangeAt,
            snoozedUntil: contact.stalenessSnoozedUntil
        )
    }

    /// FCH-06: informational filter-consequence text for the current état
    /// (nil when there's nothing to say).
    public var filterConsequenceText: String? {
        FicheFilterConsequence.text(etat: contact.etatValue, ressenti: contact.ressentiValue)
    }

    public func refresh() async {
        do {
            contact = try await vault.getContact(id: contact.id) ?? contact
        } catch {
            report("refresh", error)
        }
    }

    public func setRing(_ ring: Int) async {
        do {
            try await vault.setFicheRing(id: contact.id, ring: ring)
        } catch {
            report("setRing", error)
        }
        await refresh()
    }

    // FCH-09: these take the typed value. The view resolves a tapped chip
    // label back to it, so display copy stops at the view boundary.

    public func setEtat(_ etat: Etat) async {
        do {
            try await vault.setFicheEtat(id: contact.id, etat: etat)
        } catch {
            report("setEtat", error)
        }
        await refresh()
    }

    public func setRessenti(_ ressenti: Ressenti) async {
        do {
            try await vault.setFicheRessenti(id: contact.id, ressenti: ressenti)
        } catch {
            report("setRessenti", error)
        }
        await refresh()
    }

    /// Multi-select toggle for Rôles·contexte. Rebuilt in vocabulary order
    /// rather than append-order so two devices that toggle the same roles in
    /// different sequences persist the same array — the ordering matters once
    /// ADR-001 makes this a server-side column.
    public func toggleRole(_ role: RoleContexte) async {
        var selected = Set(contact.roleValues)
        if selected.contains(role) {
            selected.remove(role)
        } else {
            selected.insert(role)
        }
        let roles = RoleContexte.allCases.filter(selected.contains)
        do {
            try await vault.setFicheRoles(id: contact.id, roles: roles)
        } catch {
            report("setRoles", error)
        }
        await refresh()
    }

    public func reconfirmStillAccurate() async {
        do {
            try await vault.reconfirmFicheStaleness(id: contact.id)
        } catch {
            report("reconfirmStaleness", error)
        }
        await refresh()
    }

    public func snoozeStaleness() async {
        do {
            try await vault.snoozeFicheStaleness(id: contact.id)
        } catch {
            report("snoozeStaleness", error)
        }
        await refresh()
    }
}
