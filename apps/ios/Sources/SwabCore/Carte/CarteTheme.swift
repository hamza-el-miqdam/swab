import Foundation

/// Hex color constants sourced from the canonical design-token SSOT
/// (`packages/ui/tokens/tokens.json` → generated `DesignTokens.Color`, see
/// `Sources/SwabCore/Generated/DesignTokens.swift`) — the real Nuit graphic
/// charter (`docs/design-system.md`), not the stale ported RN palette this
/// used to hardcode. Kept as plain hex strings (not `Color`) so `SwabCore`
/// stays free of any UI-framework import — `SwabUI` converts these to
/// `Color` at the view layer (see `Sources/SwabUI/Carte/ColorHex.swift`).
public enum CarteTheme {
    public static let bg = DesignTokens.Color.nuit
    public static let surface = DesignTokens.Color.voile
    /// `hair` — default hairline separators/borders.
    public static let line = withOpacity(DesignTokens.Color.hair, DesignTokens.Color.hairOpacity)
    /// `hair-fort` — used here for the radial map's distance-ring circles
    /// and spokes, which need more contrast against `nuit` than a plain
    /// hairline to stay legible as navigation structure (old ringLine hex
    /// was likewise the brighter of the two line colors).
    public static let ringLine = withOpacity(DesignTokens.Color.hairFort, DesignTokens.Color.hairFortOpacity)
    public static let text = DesignTokens.Color.ivoire
    public static let textDim = DesignTokens.Color.brume
    public static let accent = DesignTokens.Color.etoile
    public static let accentInk = DesignTokens.Color.etoileEncre

    /// `hair`/`hair-fort` are opacity-bearing tokens (rgba, not solid hex)
    /// per `docs/design-system.md` §"Surfaces & structure". `CarteTheme`'s
    /// contract is a single hex `String` per color with no separate
    /// opacity channel, so the alpha is baked into an 8-digit RRGGBBAA hex
    /// string — `ColorHex.swift`'s `Color(hex:)` parses that directly.
    private static func withOpacity(_ hex: String, _ opacity: Double) -> String {
        let alpha = UInt8((opacity * 255).rounded())
        return hex + String(format: "%02x", alpha)
    }
}
