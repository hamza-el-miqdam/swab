/// Hex color constants ported verbatim from `apps/mobile/src/theme.ts`.
/// Kept as plain hex strings (not `Color`) so `SwabCore` stays free of any
/// UI-framework import — `SwabUI` converts these to `Color` at the view
/// layer (see `Sources/SwabUI/Carte/ColorHex.swift`).
public enum CarteTheme {
    public static let bg = "#16120D"
    public static let surface = "#211A12"
    public static let line = "#3B3227"
    public static let ringLine = "#4A3F2E"
    public static let text = "#F1E8DA"
    public static let textDim = "#A79A85"
    public static let accent = "#D9A441"
    public static let accentInk = "#16120D"
}
