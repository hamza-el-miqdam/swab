/// Drives the real ONB-01..08 onboarding flow through actual UI (XCUITest
/// taps/typing, not a mocked ViewModel layer) against the real local API.
/// Element lookup uses the shipped French-copy `accessibilityLabel`s
/// (`Fr.t(...)`) as the primary mechanism per the task brief: this doubles
/// as a copy/accessibility regression check — if a label's copy silently
/// changes, these lookups fail loudly instead of the test drifting quietly.
import SwabCore
import XCTest

@MainActor
enum OnboardingFlow {
    struct Contact {
        let name: String
        let ring: Int
    }

    private static let ringLabels: [Int: String] = [
        1: Fr.t(.ring1), 2: Fr.t(.ring2), 3: Fr.t(.ring3), 4: Fr.t(.ring4),
    ]

    /// Runs Welcome → phone → OTP (real dev code fetched from the local API,
    /// ONB-02) → display name (new user) → contacts (manual add, since the
    /// importer is wired `granted: false` in `SwabApp.swift`) → calibrate
    /// (places every `contacts` entry on its `ring`) → done → lands on
    /// Carte. Leaves `app` on the Carte tab (`.complete` step) when it
    /// returns.
    /// `onScreen` (optional) fires once per onboarding screen, after the
    /// screen is confirmed on-screen and fully populated (e.g. "contacts"
    /// fires AFTER all manual adds, when a counter would exist if one were
    /// ever rendered) — the ONB-09 no-gamification test hooks in here.
    static func run(
        app: XCUIApplication,
        displayName: String,
        contacts: [Contact],
        file: StaticString = #filePath,
        line: UInt = #line,
        onScreen: ((String) -> Void)? = nil
    ) async throws {
        // --- Welcome (ONB-01) ---
        let start = app.buttons[Fr.t(.welcomeCta)]
        XCTAssertTrue(start.waitForExistence(timeout: 15), "Welcome CTA not found", file: file, line: line)
        onScreen?("welcome")
        start.tap()

        // --- Phone (ONB-02) ---
        let phoneField = app.textFields[Fr.t(.phoneTitle)]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5), "Phone field not found", file: file, line: line)
        onScreen?("phone")
        phoneField.tap()
        let phone = DevBackend.freshTestPhoneNumber()
        phoneField.typeText(phone)
        app.buttons[Fr.t(.phoneCta)].tap()

        // --- OTP (ONB-02 cont'd): real code fetched from the real API,
        // hashed on-device exactly like `PhoneViewModel.requestCode` does
        // (IDT-01) — never hardcoded/guessed.
        //
        // 30s, not the usual ~15s: this is the app-under-test process's
        // FIRST network request since launch. Under Simulator + XCUITest
        // automation, a freshly-launched process consistently pays a one-
        // time ~15-23s tax on its first URLSession call (confirmed via
        // `log stream`: the whole process goes quiet — no XPC/CFNetwork
        // activity at all — for that entire span, then resolves and every
        // later request on the same process is <5ms). The Runner process's
        // own calls (`DevBackend.waitForHealth`/`requestDevOtp`) don't pay
        // this because `setUpWithError` already paid it during the health
        // check, long before this timed wait starts. Not an app bug — the
        // local API itself answers in <50ms (verified with `curl`).
        let otpField = app.textFields[Fr.t(.otpTitle)]
        XCTAssertTrue(otpField.waitForExistence(timeout: 30), "OTP screen not reached (is the API up?)", file: file, line: line)
        onScreen?("otp")
        let phoneHash = PhoneHash.hash(phone)
        let code = try await DevBackend.requestDevOtp(phoneHash: phoneHash)
        otpField.tap()
        otpField.typeText(code)
        app.buttons[Fr.t(.otpCta)].tap()

        // --- Display name (ONB-02, new-user 422 path) ---
        let nameField = app.textFields[Fr.t(.otpNamePrompt)]
        if nameField.waitForExistence(timeout: 8) {
            onScreen?("name")
            nameField.tap()
            nameField.typeText(displayName)
            app.buttons[Fr.t(.otpCta)].tap()
        }

        // --- Contacts (ONB-03): manual add only, importer is stubbed denied ---
        let manualField = app.textFields[Fr.t(.contactsManualPlaceholder)]
        XCTAssertTrue(manualField.waitForExistence(timeout: 15), "Contacts screen not reached", file: file, line: line)
        for contact in contacts {
            manualField.tap()
            manualField.typeText(contact.name)
            app.buttons[Fr.t(.contactsAdd)].tap()
        }
        onScreen?("contacts")
        let continueLabel = contacts.isEmpty ? Fr.t(.contactsSkip) : Fr.t(.contactsContinue)
        app.buttons[continueLabel].tap()

        // --- Calibrate (ONB-04/05/06): select each contact, tap its ring ---
        for contact in contacts {
            let node = app.buttons[contact.name]
            XCTAssertTrue(node.waitForExistence(timeout: 10), "\(contact.name) not on calibrate screen", file: file, line: line)
            node.tap()
            let ringLabel = ringLabels[contact.ring] ?? Fr.t(.ring1)
            let ringButton = app.buttons["\(Fr.t(.calibrateRingPrefix)) \(contact.ring) — \(ringLabel)"]
            XCTAssertTrue(ringButton.waitForExistence(timeout: 5), "Ring \(contact.ring) button not found", file: file, line: line)
            ringButton.tap()
        }
        onScreen?("calibrate")
        app.buttons[Fr.t(.calibrateContinue)].tap()

        // --- Done (ONB-07) ---
        let doneCta = app.buttons[Fr.t(.doneCta)]
        XCTAssertTrue(doneCta.waitForExistence(timeout: 15), "Done screen not reached", file: file, line: line)
        onScreen?("done")
        doneCta.tap()

        // --- Lands on Carte (ONB-07 → MAP-01) ---
        XCTAssertTrue(
            app.staticTexts[Fr.t(.carteTitle)].waitForExistence(timeout: 15),
            "Did not land on Carte after onboarding",
            file: file, line: line
        )
        onScreen?("carte")
    }
}
