/// ONB-01..08 happy path, driven through the real UI on a booted Simulator
/// against the real local API stack (`docker compose up`). See
/// `docs/specs/FS-01-onboarding.md` and
/// `docs/manual_tests/FUNCTIONAL-TEST-SCENARIO.md` Phase 1 for the manual
/// reference this automates.
import SwabCore
import XCTest

final class OnboardingE2ETests: SwabUITestCase {
    /// ONB-01..08: Welcome → phone → OTP → display name → contacts import
    /// (skipped here — importer is stubbed denied) → ring calibration →
    /// done screen → lands on Carte, with the calibrated contacts visible.
    @MainActor
    func test_ONB01to08_happyPath_reachesCarteWithCalibratedContacts() async throws {
        launchApp()
        try await OnboardingFlow.run(
            app: app,
            displayName: "Nadia",
            contacts: [
                OnboardingFlow.Contact(name: "Sam", ring: 1),
                OnboardingFlow.Contact(name: "Lina", ring: 2),
            ]
        )

        // Both calibrated contacts render on the map as their
        // `CarteLabels.contactLabel` — "<name> — <ring label>".
        XCTAssertTrue(app.buttons["Sam — \(Fr.t(.ring1))"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Lina — \(Fr.t(.ring2))"].waitForExistence(timeout: 10))

        // MAP-02: exactly the 3 persistent tabs.
        XCTAssertTrue(app.buttons[Fr.t(.navCarte)].exists)
        XCTAssertTrue(app.buttons[Fr.t(.navEnvie)].exists)
        XCTAssertTrue(app.buttons[Fr.t(.navSousGroupes)].exists)
    }

    /// ONB-03: skipping contacts entirely (« Passer ») still advances the
    /// flow all the way to a calm, empty Carte (MAP-06) — no penalty, no nag.
    @MainActor
    func test_ONB03_skippingContacts_stillReachesCarte() async throws {
        launchApp()
        try await OnboardingFlow.run(app: app, displayName: "Karim", contacts: [])

        XCTAssertTrue(app.staticTexts[Fr.t(.carteEmpty)].waitForExistence(timeout: 10))
    }

    /// ONB-09: no gamification anywhere in onboarding — no progress
    /// percentages, no progress bars, no "X contacts ajoutés !" counters,
    /// no "2/5" framing. Swept on EVERY screen of the real flow (including
    /// the contacts screen right after two adds, where a counter would
    /// exist if one were ever rendered). Positional step indication is
    /// allowed, so digits the user typed (phone/OTP) are not banned.
    @MainActor
    func test_ONB09_noGamification_onAnyOnboardingScreen() async throws {
        launchApp()
        var sweptScreens: [String] = []
        try await OnboardingFlow.run(
            app: app,
            displayName: "Sofiane",
            contacts: [
                OnboardingFlow.Contact(name: "Sam", ring: 1),
                OnboardingFlow.Contact(name: "Lina", ring: 2),
            ],
            onScreen: { screen in
                sweptScreens.append(screen)
                self.assertNoGamification(on: screen)
            }
        )

        // The sweep genuinely visited every step (guards against the hook
        // silently not firing and the test passing vacuously).
        XCTAssertEqual(
            sweptScreens,
            ["welcome", "phone", "otp", "name", "contacts", "calibrate", "done", "carte"],
            "ONB-09 sweep did not cover the full onboarding flow"
        )
    }

    /// SUG-DES-004 acceptance criterion: "screenshot check that titles
    /// render Space Grotesk (glyph difference from SF is visible on 'S')".
    /// Attaches a screenshot of the wordmark (Fr.t(.brandName) = "Swab",
    /// starts with "S") to the test report for visual audit. This is NOT
    /// automated pixel-diffing against a golden image — no such baseline
    /// infra exists in this suite — so it cannot fail on a silent
    /// system-font fallback by itself; `TypographyFontBundlingTests`
    /// (`xcrun swift test`) is the deterministic guard for that failure
    /// mode, verifying the bundled .ttf's internal PostScript name against
    /// what `Font.custom(...)` actually requests.
    @MainActor
    func test_SUGDES004_wordmarkScreenshot_forSpaceGroteskVisualAudit() async throws {
        launchApp()
        let brandName = app.staticTexts[Fr.t(.brandName)]
        XCTAssertTrue(brandName.waitForExistence(timeout: 10))

        let attachment = XCTAttachment(screenshot: brandName.screenshot())
        attachment.name = "wordmark-space-grotesk-glyph-check"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
