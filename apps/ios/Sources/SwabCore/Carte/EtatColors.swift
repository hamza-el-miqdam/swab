/// MAP-03 — état → node color. Port of `apps/mobile/src/map/etatColors.ts`.
///
/// DIVERGENCE FLAG (carried forward, not silently resolved — see
/// `docs/migration/rn-native-handoff.md` §5): the blueprint's richer
/// 5-état taxonomy is mapped onto the SHIPPED 3-état vocabulary
/// (disponible / occupé / ailleurs). Do not expand this to 5 without a
/// product decision — the RN reference has the same divergence.
public enum EtatColors {
    /// SUG-DES-006: sourced from the token SSOT (`DesignTokens.Color.etat*`,
    /// generated from `packages/ui/tokens/tokens.json`), not hardcoded —
    /// pure indirection, values unchanged (`.uppercased()` only normalizes
    /// casing to match this file's existing hex convention).
    public static let available = DesignTokens.Color.etatDisponible.uppercased()
    public static let busy = DesignTokens.Color.etatOccupe.uppercased()
    public static let away = DesignTokens.Color.etatAilleurs.uppercased()
    /// OQ-FCH-2 (resolved 2026-08-09, issue #16): "en pause" moved from
    /// Ressenti to État. No prior color existed for it on this axis (it had
    /// none as a Ressenti value either — Ressenti carries no colors), so
    /// this is a new pick: muted violet-grey, desaturated to match the
    /// existing three (none of which it's derived from).
    public static let paused = "#9A8FB5"

    /// FCH-09: keyed by the stored identifier, not by display copy. This
    /// used to be `byLabel`, a dictionary literally keyed by `Fr.t(...)` —
    /// so rewording « occupé » (or shipping a second locale) turned every
    /// stored value into a lookup miss, and the contact rendered as unset
    /// through `color(for:)`'s fallback while its data was still there.
    public static let byEtat: [Etat: String] = [
        .available: available,
        .busy: busy,
        .away: away,
        .paused: paused,
    ]

    public struct EtatColor: Equatable, Sendable {
        public let background: String
        public let border: String

        public init(background: String, border: String) {
            self.background = background
            self.border = border
        }
    }

    /// Unset or unrecognized état → neutral surface color, never a
    /// crash/placeholder color. Callers pass `contact.etatValue`, which is
    /// `nil` for a token outside the FCH-09 vocabulary.
    public static func color(for etat: Etat?) -> EtatColor {
        guard let etat, let background = byEtat[etat] else {
            return EtatColor(background: CarteTheme.surface, border: CarteTheme.line)
        }
        return EtatColor(background: background, border: background)
    }
}
