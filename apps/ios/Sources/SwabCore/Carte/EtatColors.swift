/// MAP-03 — état → node color. Port of `apps/mobile/src/map/etatColors.ts`.
///
/// DIVERGENCE FLAG (carried forward, not silently resolved — see
/// `docs/migration/rn-native-handoff.md` §5): the blueprint's richer
/// 5-état taxonomy is mapped onto the SHIPPED 3-état vocabulary
/// (disponible / occupé / ailleurs). Do not expand this to 5 without a
/// product decision — the RN reference has the same divergence.
public enum EtatColors {
    public static let available = "#8FB59A"
    public static let busy = "#C8917E"
    public static let away = "#8AA0BE"
    /// OQ-FCH-2 (resolved 2026-08-09, issue #16): "en pause" moved from
    /// Ressenti to État. No prior color existed for it on this axis (it had
    /// none as a Ressenti value either — Ressenti carries no colors), so
    /// this is a new pick: muted violet-grey, desaturated to match the
    /// existing three (none of which it's derived from).
    public static let paused = "#9A8FB5"

    /// Keyed by the French copy value stored on `VaultContact.etat`
    /// (`Fr.t(.etatAvailable)` etc.) — matches the RN reference, which keys
    /// off `t('etat.available')` rather than an internal enum.
    public static let byLabel: [String: String] = [
        Fr.t(.etatAvailable): available,
        Fr.t(.etatBusy): busy,
        Fr.t(.etatAway): away,
        Fr.t(.etatPaused): paused,
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
    /// crash/placeholder color.
    public static func color(for etat: String?) -> EtatColor {
        guard let etat, let background = byLabel[etat] else {
            return EtatColor(background: CarteTheme.surface, border: CarteTheme.line)
        }
        return EtatColor(background: background, border: background)
    }
}
