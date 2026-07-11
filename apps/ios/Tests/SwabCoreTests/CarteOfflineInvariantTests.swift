/// MAP-05: the carte renders fully offline from the vault — no network
/// call is needed to render. This is asserted structurally, mirroring the
/// RN reference's own MAP-05 test that scans `carte.tsx`/`RadialMap.tsx`
/// source for API imports: we read `CarteViewModel.swift`'s source text
/// (the one file that owns carte state) directly off disk relative to this
/// test file's own `#filePath`, and fail loudly if a networking symbol
/// ever sneaks in.
///
/// This is a source-text scan, not a compiled-symbol check, so it is a
/// tripwire rather than a proof — but it catches the obvious regression
/// (someone importing `Foundation`'s `URLSession` or `SwabCore`'s
/// `ApiClient` into carte state) the same way `ApiClientPrivacyInvariantTests`
/// catches a stray field on a request body.
import XCTest

final class CarteOfflineInvariantTests: XCTestCase {
    private static let bannedSymbols = ["URLSession", "ApiClient", "HTTPTransport", "VaultSync"]

    private func carteViewModelSource(file: StaticString = #filePath) throws -> String {
        // This test file lives at .../apps/ios/Tests/SwabCoreTests/<this file>.
        // CarteViewModel.swift lives at .../apps/ios/Sources/SwabUI/Carte/CarteViewModel.swift.
        let thisFile = URL(fileURLWithPath: "\(file)")
        let iosRoot = thisFile
            .deletingLastPathComponent() // CarteOfflineInvariantTests.swift -> SwabCoreTests/
            .deletingLastPathComponent() // SwabCoreTests/ -> Tests/
            .deletingLastPathComponent() // Tests/ -> apps/ios/
        let target = iosRoot
            .appendingPathComponent("Sources/SwabUI/Carte/CarteViewModel.swift")
        return try String(contentsOf: target, encoding: .utf8)
    }

    func test_MAP05_carteViewModelHasNoNetworkingImportOrSymbol() throws {
        let source = try carteViewModelSource()
        for symbol in Self.bannedSymbols {
            XCTAssertFalse(
                source.contains(symbol),
                "CarteViewModel.swift references '\(symbol)' — the carte must render fully "
                    + "offline from the vault (MAP-05); no networking type may appear here."
            )
        }
    }

    func test_MAP05_carteViewModelSourceIsReadable() throws {
        let source = try carteViewModelSource()
        XCTAssertTrue(source.contains("class CarteViewModel"), "sanity check: found the wrong file")
    }
}
