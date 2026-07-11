/// Shared accessibility vocabulary for the carte (MAP-08 acceptance: every
/// contact announces name + ring, identically in map and list). Port of
/// `apps/mobile/src/map/labels.ts`.
import Foundation

public enum CarteLabels {
    public static let ringLabel: [Int: String] = [
        1: Fr.t(.ring1),
        2: Fr.t(.ring2),
        3: Fr.t(.ring3),
        4: Fr.t(.ring4),
    ]

    /// « Léa — Très proche » for placed contacts, plain name otherwise.
    public static func contactLabel(_ contact: VaultContact) -> String {
        guard let ring = contact.ring, let label = ringLabel[ring] else {
            return contact.displayName
        }
        return "\(contact.displayName) — \(label)"
    }

    /// Up to two initials — glanceable node content, never the full name.
    public static func initials(_ displayName: String) -> String {
        displayName
            .split(whereSeparator: { $0.isWhitespace })
            .prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }
            .joined()
    }
}
