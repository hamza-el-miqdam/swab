/// SUG-DES-004 — maps `DesignTokens.Typography` styles (generated SSOT,
/// `packages/ui/tokens/tokens.json`) to SwiftUI `Font`s honoring the
/// SUG-DES-012 Dynamic-Type contract (`docs/design-system.md` §2): SSOT
/// `size` is the reference at default scale, fonts scale via
/// `Font.custom(_:size:relativeTo:)` (backed by `UIFontMetrics`), and
/// `letterSpacingEm` is em-relative — multiplied by the *rendered* (scaled)
/// size, never the unscaled reference, so tracking stays proportionally
/// correct as Dynamic Type grows.
import SwabCore
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

extension DesignTokens.TypographyStyle {
    /// The PostScript name of the bundled font file for this style's
    /// (family, weight) pair — NOT simply `family`.
    ///
    /// GOTCHA (verified directly against `fonts.gstatic.com`, not a local
    /// packaging bug): Google's static-instance TTF export for Space
    /// Grotesk embeds **every** weight (300-700) under the internal family
    /// name "Space Grotesk Light" — e.g. the 600-weight file's `name` table
    /// says family "Space Grotesk Light", subfamily "SemiBold". Referencing
    /// `Font.custom("Space Grotesk", ...)` therefore fails to resolve and
    /// SwiftUI silently falls back to the system font. Inter's static
    /// exports are unaffected (family "Inter" throughout). Bundled files
    /// live in `App/Resources/Fonts/`.
    var postScriptName: String {
        switch (family, weight) {
        case ("Inter", 400): return "Inter-Regular"
        case ("Inter", 500): return "Inter-Medium"
        case ("Inter", 600): return "Inter-SemiBold"
        case ("Space Grotesk", 400): return "SpaceGroteskLight-Regular"
        case ("Space Grotesk", 500): return "SpaceGroteskLight-Medium"
        case ("Space Grotesk", 600): return "SpaceGroteskLight-SemiBold"
        default: return family // unrecognized combo — falls back to the system font rather than crashing
        }
    }
}

/// Applies a `DesignTokens.Typography` style's font (family/size, Dynamic
/// Type-scaled) and em-relative letter-spacing.
public struct SwabTypeStyle: ViewModifier {
    let style: DesignTokens.TypographyStyle
    let relativeTo: Font.TextStyle

    public init(_ style: DesignTokens.TypographyStyle, relativeTo: Font.TextStyle = .body) {
        self.style = style
        self.relativeTo = relativeTo
    }

    public func body(content: Content) -> some View {
        content
            .font(.custom(style.postScriptName, size: style.size, relativeTo: relativeTo))
            .tracking(scaledSize * style.letterSpacingEm)
    }

    /// `UIFontMetrics` gives the actual *rendered* size at the current
    /// Dynamic Type setting — required because `letterSpacingEm` must scale
    /// with the text, not the unscaled SSOT reference size. No UIKit
    /// equivalent exists off-iOS (this Package also builds for macOS purely
    /// so `xcrun swift test` is CLI-runnable, see `Package.swift`); the
    /// non-iOS fallback uses the unscaled reference, exercised only by that
    /// CLI test run, never a real device.
    private var scaledSize: Double {
        #if canImport(UIKit)
        UIFontMetrics(forTextStyle: relativeTo.uiTextStyle).scaledValue(for: style.size)
        #else
        style.size
        #endif
    }
}

public extension View {
    /// Applies a `DesignTokens.Typography` style (font family/size/tracking),
    /// scaling with Dynamic Type per the SUG-DES-012 contract. `relativeTo`
    /// should be the SwiftUI text style this replaces — it anchors the
    /// Dynamic Type scaling curve, independent of the token's own size. See
    /// `SwabTypeStyle`.
    func swabType(_ style: DesignTokens.TypographyStyle, relativeTo: Font.TextStyle = .body) -> some View {
        modifier(SwabTypeStyle(style, relativeTo: relativeTo))
    }
}

#if canImport(UIKit)
private extension Font.TextStyle {
    /// `UIFontMetrics` needs a UIKit `UIFont.TextStyle`; SwiftUI's own
    /// `Font.TextStyle` has no built-in bridge to it.
    var uiTextStyle: UIFont.TextStyle {
        switch self {
        case .largeTitle: return .largeTitle
        case .title: return .title1
        case .title2: return .title2
        case .title3: return .title3
        case .headline: return .headline
        case .body: return .body
        case .callout: return .callout
        case .subheadline: return .subheadline
        case .footnote: return .footnote
        case .caption: return .caption1
        case .caption2: return .caption2
        default: return .body
        }
    }
}
#endif
