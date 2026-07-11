/// Shared setup for every E2E test: confirms the real local API is up
/// (fails fast + legibly instead of every UI step timing out mysteriously),
/// then launches the real app with `--uitesting-reset` so each test starts
/// from a genuinely fresh install (the vault/session persist on-device
/// otherwise) without needing an out-of-process `xcrun simctl uninstall`
/// between tests (a UI test bundle runs inside the Simulator and cannot
/// shell out to the host `simctl`).
import XCTest

class SwabUITestCase: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        let expectation = expectation(description: "local API health check")
        Task {
            do {
                try await DevBackend.waitForHealth()
                expectation.fulfill()
            } catch {
                XCTFail("Local API stack unreachable at \(DevBackend.baseURL) — run `docker compose up --build -d` first: \(error)")
                expectation.fulfill()
            }
        }
        wait(for: [expectation], timeout: 20)
    }

    /// Launches with the reset hook. Pass `seedLegacyVault: true` to also
    /// exercise the pre-FS-03 vault backward-compat seam end-to-end
    /// (`UITestHooks.seedLegacyVaultArgument` in `App/SwabApp.swift`).
    func launchApp(seedLegacyVault: Bool = false) {
        var args = ["--uitesting-reset"]
        if seedLegacyVault {
            args.append("--uitesting-seed-legacy-vault")
        }
        app.launchArguments = args
        app.launch()
    }

    /// ONB-09 / MAP-06 / product law 5 — shared "no gamification" sweep of
    /// whatever screen is currently showing: no progress bars/spinners-as-
    /// progress, no percentage copy, no "N contacts/personnes/amis" counter
    /// copy, no "x / y" progress framing. Positional step indication (plain
    /// words, no numbers) remains allowed by ONB-09, so this deliberately
    /// does NOT ban every digit (phone/OTP screens legitimately show digits
    /// the user typed).
    func assertNoGamification(on screen: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(
            app.progressIndicators.count, 0,
            "ONB-09: progress indicator rendered on \(screen)", file: file, line: line
        )

        let texts = app.staticTexts
        let percent = texts.matching(NSPredicate(format: "label CONTAINS %@", "%"))
        XCTAssertEqual(
            percent.count, 0,
            "ONB-09: percentage copy on \(screen): \(percent.allElementsBoundByIndex.map(\.label))",
            file: file, line: line
        )

        let counter = texts.matching(NSPredicate(
            format: "label MATCHES %@", ".*[0-9]+\\s*(contact|personne|ami).*"
        ))
        XCTAssertEqual(
            counter.count, 0,
            "ONB-09: counter copy on \(screen): \(counter.allElementsBoundByIndex.map(\.label))",
            file: file, line: line
        )

        let ratio = texts.matching(NSPredicate(
            format: "label MATCHES %@", ".*[0-9]+\\s*/\\s*[0-9]+.*"
        ))
        XCTAssertEqual(
            ratio.count, 0,
            "ONB-09: x/y progress framing on \(screen): \(ratio.allElementsBoundByIndex.map(\.label))",
            file: file, line: line
        )
    }
}
