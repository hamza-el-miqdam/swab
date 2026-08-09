/// SUG-DES-004 — regression guard for the exact failure mode font bundling
/// can hit silently: `Font.custom(name:...)` resolves by PostScript name,
/// and if that name doesn't match what a bundled .ttf actually carries
/// internally, SwiftUI falls back to the system font with NO error, crash,
/// or warning. Caught during this suggestion's implementation: Google's
/// static-instance TTF export for Space Grotesk embeds every weight
/// (300-700) under the internal family "Space Grotesk Light" — verified
/// directly against `fonts.gstatic.com`, not a local packaging bug — so
/// `Typography.swift`'s `postScriptName` maps to `SpaceGroteskLight-*`,
/// not `SpaceGrotesk-*`. These tests fail loudly if that mapping and the
/// bundled files ever drift apart again.
import XCTest
@testable import SwabUI
import SwabCore
#if canImport(CoreGraphics)
import CoreGraphics
#endif

final class TypographyFontBundlingTests: XCTestCase {
    private struct BundledFont {
        let filename: String
        let family: String
        let weight: Int
    }

    private static let bundledFonts: [BundledFont] = [
        BundledFont(filename: "Inter-Regular.ttf", family: "Inter", weight: 400),
        BundledFont(filename: "Inter-Medium.ttf", family: "Inter", weight: 500),
        BundledFont(filename: "Inter-SemiBold.ttf", family: "Inter", weight: 600),
        BundledFont(filename: "SpaceGrotesk-Regular.ttf", family: "Space Grotesk", weight: 400),
        BundledFont(filename: "SpaceGrotesk-Medium.ttf", family: "Space Grotesk", weight: 500),
        BundledFont(filename: "SpaceGrotesk-SemiBold.ttf", family: "Space Grotesk", weight: 600),
    ]

    /// `App/Resources/Fonts/` is app-target scope, not this Swift package —
    /// resolved relative to this source file (`#filePath`) rather than the
    /// process's current directory, so this test works regardless of where
    /// `swift test` is invoked from.
    private static let fontsDirectory: URL = {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // TypographyFontBundlingTests.swift
            .deletingLastPathComponent() // SwabUITests
            .deletingLastPathComponent() // Tests
            .appendingPathComponent("App/Resources/Fonts")
    }()

    /// Every bundled .ttf's actual internal PostScript name (read straight
    /// off the file's `name` table via CoreGraphics — no CTFontManager
    /// registration needed) must equal what `postScriptName` computes for
    /// its (family, weight) — otherwise `Font.custom(...)` in
    /// `SwabTypeStyle` silently resolves to nothing.
    func test_SUGDES004_bundledFontFiles_matchTypographyPostScriptNameMapping() throws {
        #if canImport(CoreGraphics)
        for entry in Self.bundledFonts {
            let url = Self.fontsDirectory.appendingPathComponent(entry.filename)
            let data = try Data(contentsOf: url)

            let provider = CGDataProvider(data: data as CFData)
            let font = provider.flatMap { CGFont($0) }
            XCTAssertNotNil(font, "\(entry.filename) is not a valid font file")

            let probe = DesignTokens.TypographyStyle(
                family: entry.family, size: 10, weight: entry.weight,
                lineHeight: 1, letterSpacingEm: 0, textTransform: "none"
            )
            XCTAssertEqual(
                font?.postScriptName as String?, probe.postScriptName,
                "\(entry.filename)'s internal PostScript name does not match Typography.swift's " +
                "postScriptName mapping for (\(entry.family), \(entry.weight))"
            )
        }
        #endif
    }

    /// Every `DesignTokens.Typography.*` role the app actually uses must
    /// resolve to one of the bundled files' real PostScript names — if a
    /// role's (family, weight) has no `case` in `postScriptName`, it falls
    /// through to `default: return family` ("Inter"/"Space Grotesk"), which
    /// is NOT a valid PostScript name and renders as the system font with
    /// no warning.
    func test_SUGDES004_allTypographyStyles_haveAKnownBundledPostScriptName() {
        let knownPostScriptNames: Set<String> = [
            "Inter-Regular", "Inter-Medium", "Inter-SemiBold",
            "SpaceGroteskLight-Regular", "SpaceGroteskLight-Medium", "SpaceGroteskLight-SemiBold",
        ]
        let styles: [DesignTokens.TypographyStyle] = [
            DesignTokens.Typography.wordmark,
            DesignTokens.Typography.title,
            DesignTokens.Typography.doneTitle,
            DesignTokens.Typography.base,
            DesignTokens.Typography.button,
            DesignTokens.Typography.subtitle,
            DesignTokens.Typography.tag,
            DesignTokens.Typography.caption,
            DesignTokens.Typography.label,
        ]
        for style in styles {
            XCTAssertTrue(
                knownPostScriptNames.contains(style.postScriptName),
                "\(style.family)/\(style.weight) resolved to '\(style.postScriptName)', which is not a " +
                "bundled PostScript name — it will silently render as the system font"
            )
        }
    }
}
