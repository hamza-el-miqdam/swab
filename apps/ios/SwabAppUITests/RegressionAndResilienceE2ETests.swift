/// Regression + resilience smoke tests that don't fit the main onboarding/
/// map/fiche happy-path flows.
import SwabCore
import XCTest

final class RegressionAndResilienceE2ETests: SwabUITestCase {
    /// REGRESSION: a pre-FS-03 vault (no `history`/`targetId`/staleness
    /// fields — `VaultContact.init(from:)`'s backward-compat contract) must
    /// not crash the app on launch/decode. Seeded through the REAL
    /// encrypt/decrypt path via `UITestHooks.seedLegacyVaultArgument`
    /// (`App/SwabApp.swift`), exercising the exact production code path
    /// `Vault.hydrate()` takes — not a unit-level double.
    @MainActor
    func test_vaultBackwardCompat_legacyShapeDoesNotCrashOnLaunch() throws {
        launchApp(seedLegacyVault: true)

        // App boots straight to Carte (seeded onboarding step = complete)
        // instead of crashing while decoding the legacy blob. 30s for the
        // same reason as `OnboardingFlow`'s OTP wait: `UITestHooks.apply`
        // does the process's first Keychain/CryptoKit touch (random vault
        // key, encrypt) before content renders, which pays the same one-
        // time per-process Simulator/XCUITest automation tax.
        XCTAssertTrue(app.staticTexts[Fr.t(.carteTitle)].waitForExistence(timeout: 30), "App did not reach Carte — legacy vault decode likely crashed")
        XCTAssertEqual(app.state, .runningForeground, "App is not still running after decoding a legacy vault shape")

        // The legacy contact (ring=1, etat=disponible, no history/targetId)
        // rendered correctly despite the missing fields.
        XCTAssertTrue(
            app.buttons["Contact Historique — \(Fr.t(.ring1))"].waitForExistence(timeout: 10),
            "Legacy contact did not render on the map"
        )
    }

    /// Basic resilience check (not a full FS-07 offline/sync test, which is
    /// already covered at the unit level): backgrounding and foregrounding
    /// the app mid-flow must not crash it.
    @MainActor
    func test_backgroundForeground_midOnboarding_doesNotCrash() async throws {
        launchApp()
        let start = app.buttons[Fr.t(.welcomeCta)]
        XCTAssertTrue(start.waitForExistence(timeout: 15))
        start.tap()

        let phoneField = app.textFields[Fr.t(.phoneTitle)]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
        phoneField.tap()
        phoneField.typeText(DevBackend.freshTestPhoneNumber())

        XCUIDevice.shared.press(.home)
        app.activate()

        // Check the element first (it polls/waits) rather than `app.state`
        // first (an instantaneous read) — `activate()` returning doesn't
        // guarantee the state transition has fully settled yet.
        XCTAssertTrue(app.buttons[Fr.t(.phoneCta)].waitForExistence(timeout: 10), "App did not resume the phone screen after foregrounding")
        XCTAssertEqual(app.state, .runningForeground, "App did not survive a background/foreground cycle mid-onboarding")
    }

    /// Basic resilience check on the map/carte screen: same background/
    /// foreground cycle after onboarding is complete.
    @MainActor
    func test_backgroundForeground_onCarte_doesNotCrash() async throws {
        launchApp()
        try await OnboardingFlow.run(app: app, displayName: "Yasmine", contacts: [])

        XCUIDevice.shared.press(.home)
        app.activate()

        XCTAssertEqual(app.state, .runningForeground, "App did not survive a background/foreground cycle on Carte")
        XCTAssertTrue(app.staticTexts[Fr.t(.carteTitle)].waitForExistence(timeout: 10))
    }
}
