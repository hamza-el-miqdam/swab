/// FCH-04 — the fiche's history feed: axis changes + coarse relationship
/// events over 12 months, newest first. Sourced ONLY from the vault (no new
/// network calls) — this type never leaves the encrypted blob boundary; it
/// is `Codable` purely so it round-trips inside `VaultData`, never so it can
/// be sent over the wire on its own.
import Foundation

public struct FicheHistoryEvent: Codable, Equatable, Hashable, Sendable, Identifiable {
    public enum Kind: Codable, Equatable, Hashable, Sendable {
        /// `axis` is a `FicheAxis.rawValue`; `value` is the new value's
        /// display string (nil when an axis was cleared).
        case axisChanged(axis: String, value: String?)
        /// FCH-05 "C'est toujours ça" — re-confirms without changing a value.
        case reconfirmed
        /// FCH-04's "relationship events (matches with this person, at
        /// coarse grain)" — free-text, coarse-grained on purpose; FS-05
        /// (envie/match) isn't built yet, so nothing populates this case
        /// today, but the shape exists so a future match event can append
        /// here without a vault-shape migration.
        case relationshipEvent(String)
    }

    public var id: String
    public var date: Date
    public var kind: Kind

    public init(id: String = UUID().uuidString, date: Date = Date(), kind: Kind) {
        self.id = id
        self.date = date
        self.kind = kind
    }
}
