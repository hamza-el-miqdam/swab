/// MAP-01..09 (relationship map) and FCH-01..08 (contact card / fiche),
/// driven through the real UI. Also the regression home for two
/// documented past bugs (`apps/ios/CHANGELOG.md`):
///   - the peek sheet's « Ouvrir la fiche » button must be genuinely
///     tappable (Wave 3 removed a `.disabled(true)` on it — confirm no
///     residual disabled state slipped back in);
///   - FCH-07: returning from the fiche must not lose the map/contact.
import SwabCore
import XCTest

final class MapAndFicheE2ETests: SwabUITestCase {
    @MainActor
    private func onboardWithSam() async throws {
        launchApp()
        try await OnboardingFlow.run(
            app: app,
            displayName: "Nadia",
            contacts: [OnboardingFlow.Contact(name: "Sam", ring: 1)]
        )
    }

    /// MAP-01/03/04: map renders « moi » + the contact node; tapping the
    /// node opens the peek sheet with the correct Intimité/État/Rôles rows
    /// and a genuinely ENABLED « Ouvrir la fiche » button (regression for
    /// the Wave 2→3 disabled-button seam).
    @MainActor
    func test_MAP04_peekSheet_showsCorrectRowsAndEnabledOpenFiche() async throws {
        try await onboardWithSam()

        let samNode = app.buttons["Sam — \(Fr.t(.ring1))"]
        XCTAssertTrue(samNode.waitForExistence(timeout: 10))
        samNode.tap()

        XCTAssertTrue(app.staticTexts[Fr.t(.carteSheetIntimite)].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts[Fr.t(.ring1)].exists, "Peek sheet should show the Très proche ring value")
        XCTAssertTrue(app.staticTexts[Fr.t(.carteSheetEtat)].exists)
        XCTAssertTrue(app.staticTexts[Fr.t(.carteSheetRoles)].exists)

        let openFiche = app.buttons[Fr.t(.carteOpenFiche)]
        XCTAssertTrue(openFiche.exists)
        XCTAssertTrue(openFiche.isEnabled, "REGRESSION: « Ouvrir la fiche » must not be disabled (Wave 3 seam)")
        XCTAssertTrue(openFiche.isHittable, "REGRESSION: « Ouvrir la fiche » must be genuinely tappable, not just visible")
    }

    /// MAP-08: list mode toggle groups contacts by ring, feature-equivalent
    /// to the radial map (same tap target, same label vocabulary).
    @MainActor
    func test_MAP08_listMode_groupsContactsByIntimacyLevel() async throws {
        try await onboardWithSam()

        app.switches[Fr.t(.carteListMode)].tap()

        XCTAssertTrue(app.staticTexts[Fr.t(.ring1)].waitForExistence(timeout: 5), "Ring section header not shown in list mode")
        XCTAssertTrue(app.buttons["Sam — \(Fr.t(.ring1))"].exists, "Contact row not shown in list mode")
    }

    /// FCH-01/07: opening the fiche, editing an axis, navigating back, and
    /// re-opening it shows the edit persisted — and the map is still there
    /// (not torn down/reset) when we return, per FCH-07's "position
    /// preserved" contract (achieved via `.navigationDestination(item:)`
    /// staying on the same `NavigationStack`, see `CarteView.swift`).
    @MainActor
    func test_FCH01_and_FCH07_editPersists_andMapSurvivesRoundTrip() async throws {
        try await onboardWithSam()

        let samNode = app.buttons["Sam — \(Fr.t(.ring1))"]
        XCTAssertTrue(samNode.waitForExistence(timeout: 10))
        samNode.tap()
        app.buttons[Fr.t(.carteOpenFiche)].tap()

        // Fiche opened for Sam.
        XCTAssertTrue(app.navigationBars["Sam"].waitForExistence(timeout: 10), "Fiche did not open for Sam")

        // FCH-01: tap a different ring chip (plain ring label, distinct from
        // the "Anneau N — <label>" buttons used on the calibration screen).
        let proche = app.buttons[Fr.t(.ring2)]
        XCTAssertTrue(proche.waitForExistence(timeout: 5))
        proche.tap()
        XCTAssertTrue(proche.isSelected, "Ring chip should show selected state immediately after tapping (optimistic vault write)")

        // Also flip État so the peek sheet has something new to show.
        let occupe = app.buttons[Fr.t(.etatBusy)]
        XCTAssertTrue(occupe.waitForExistence(timeout: 5))
        occupe.tap()

        // Navigate back via the system back button (FicheView is PUSHED
        // onto the same NavigationStack the carte lives in, not presented
        // as a sheet — FCH-07's mechanism).
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // Back on Carte — not reset, not relaunched.
        XCTAssertTrue(app.staticTexts[Fr.t(.carteTitle)].waitForExistence(timeout: 10), "Did not return to Carte")

        // MAP-04: node label reflects the new ring live.
        let updatedNode = app.buttons["Sam — \(Fr.t(.ring2))"]
        XCTAssertTrue(updatedNode.waitForExistence(timeout: 10), "Map node did not update to the new ring after returning from the fiche")
        updatedNode.tap()

        // Peek sheet reflects the persisted edits.
        XCTAssertTrue(app.staticTexts[Fr.t(.ring2)].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts[Fr.t(.etatBusy)].waitForExistence(timeout: 5))

        // Re-open the fiche: the axis edit persisted across the round trip.
        app.buttons[Fr.t(.carteOpenFiche)].tap()
        let reopenedProche = app.buttons[Fr.t(.ring2)]
        XCTAssertTrue(reopenedProche.waitForExistence(timeout: 10))
        XCTAssertTrue(reopenedProche.isSelected, "FCH-01 edit did not persist across navigating away and back")
    }

    /// MAP-02: the persistent tab bar exposes EXACTLY three destinations —
    /// Carte, Envie, Sous-groupes — and none of them carries a badge or
    /// unread counter (ethos law 5: no counters anywhere).
    @MainActor
    func test_MAP02_tabBar_exactlyThreeDestinations_noBadges() async throws {
        launchApp()
        try await OnboardingFlow.run(app: app, displayName: "Nadia", contacts: [])

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 10), "Tab bar not found on Carte")

        let tabs = tabBar.buttons
        XCTAssertEqual(tabs.count, 3, "MAP-02: exactly three destinations, found \(tabs.allElementsBoundByIndex.map(\.label))")
        XCTAssertTrue(tabs[Fr.t(.navCarte)].exists, "Carte tab missing")
        XCTAssertTrue(tabs[Fr.t(.navEnvie)].exists, "Envie tab missing")
        XCTAssertTrue(tabs[Fr.t(.navSousGroupes)].exists, "Sous-groupes tab missing")

        // No badge / unread counter: a UIKit/SwiftUI tab badge concatenates
        // into the accessibility label (e.g. "Envie, 3 nouveaux éléments"),
        // so any digit in a tab's label is a badge leaking through.
        let badged = tabs.matching(NSPredicate(format: "label MATCHES %@", ".*[0-9].*"))
        XCTAssertEqual(
            badged.count, 0,
            "MAP-02: nav item carries a badge/counter: \(badged.allElementsBoundByIndex.map(\.label))"
        )
        // And nothing else rides inside the tab bar besides the 3 buttons
        // (no floating dot/badge as a sibling element).
        XCTAssertEqual(tabBar.staticTexts.matching(NSPredicate(format: "label MATCHES %@", ".*[0-9].*")).count, 0)
    }

    /// MAP-06: the empty/sparse map is calm — the approved quiet copy is
    /// shown, with no progress framing, no percentage, no counter, and no
    /// "add more" pressure. (`assertNoGamification` is the same sweep
    /// ONB-09 uses; MAP-06 additionally pins the exact empty-state copy.)
    @MainActor
    func test_MAP06_emptyMap_isCalm_noProgressFramingOrPressureCopy() async throws {
        launchApp()
        try await OnboardingFlow.run(app: app, displayName: "Imane", contacts: [])

        // The one approved empty-state line, verbatim (French copy is
        // normative — an "Ajoute encore X personnes !" nag would not match).
        XCTAssertTrue(
            app.staticTexts[Fr.t(.carteEmpty)].waitForExistence(timeout: 10),
            "Calm empty-state copy missing on an empty Carte"
        )

        assertNoGamification(on: "carte vide")

        // No urgency/pressure vocabulary anywhere on the empty map.
        for banned in ["encore", "Encore", "Dépêche", "vite", "presque", "complète", "Complète"] {
            XCTAssertEqual(
                app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", banned)).count, 0,
                "MAP-06: pressure copy « \(banned) » found on the empty Carte"
            )
        }
    }

    /// FCH-04: editing an axis on the fiche appends a history event to
    /// « Ce qui a bougé », newest first, and replaces the empty-history
    /// copy. Two successive edits verify the newest-first ordering by
    /// on-screen position (second edit renders ABOVE the first).
    @MainActor
    func test_FCH04_axisEdit_appendsHistoryEvent_newestFirst() async throws {
        try await onboardWithSam()

        let samNode = app.buttons["Sam — \(Fr.t(.ring1))"]
        XCTAssertTrue(samNode.waitForExistence(timeout: 10))
        samNode.tap()
        app.buttons[Fr.t(.carteOpenFiche)].tap()
        XCTAssertTrue(app.navigationBars["Sam"].waitForExistence(timeout: 10), "Fiche did not open for Sam")

        // Fresh fiche: no history yet (onboarding calibration deliberately
        // leaves no trail — only fiche edits do).
        XCTAssertTrue(app.staticTexts[Fr.t(.ficheHistoryEmpty)].waitForExistence(timeout: 5), "Fresh fiche should show the empty-history copy")

        // Edit 1: Intimité → Proche.
        let proche = app.buttons[Fr.t(.ring2)]
        XCTAssertTrue(proche.waitForExistence(timeout: 5))
        proche.tap()
        let intimiteEvent = app.staticTexts["\(Fr.t(.ficheAxisIntimite)) → \(Fr.t(.ring2))"]
        XCTAssertTrue(intimiteEvent.waitForExistence(timeout: 10), "FCH-04: no history event after an Intimité edit")
        XCTAssertFalse(app.staticTexts[Fr.t(.ficheHistoryEmpty)].exists, "Empty-history copy should disappear once an event exists")

        // Edit 2: État → occupé.
        let occupe = app.buttons[Fr.t(.etatBusy)]
        XCTAssertTrue(occupe.waitForExistence(timeout: 5))
        if !occupe.isHittable { app.swipeUp() }
        occupe.tap()
        let etatEvent = app.staticTexts["\(Fr.t(.ficheAxisEtat)) → \(Fr.t(.etatBusy))"]
        XCTAssertTrue(etatEvent.waitForExistence(timeout: 10), "FCH-04: no history event after an État edit")

        // Newest first: the later edit (État) renders above the earlier one.
        XCTAssertLessThan(
            etatEvent.frame.minY, intimiteEvent.frame.minY,
            "FCH-04: history feed is not newest-first"
        )
    }

    /// FCH-08: a manually-added contact who hasn't joined Swab (pending
    /// link, `targetId = nil` — exactly what onboarding's manual add
    /// creates) still gets a fiche whose axes are fully editable, with
    /// envie eligibility clearly shown as inactive.
    @MainActor
    func test_FCH08_pendingContact_ficheEditable_envieShownInactive() async throws {
        try await onboardWithSam()

        let samNode = app.buttons["Sam — \(Fr.t(.ring1))"]
        XCTAssertTrue(samNode.waitForExistence(timeout: 10))
        samNode.tap()
        app.buttons[Fr.t(.carteOpenFiche)].tap()
        XCTAssertTrue(app.navigationBars["Sam"].waitForExistence(timeout: 10), "Fiche did not open for Sam")

        // Envie eligibility clearly indicated as inactive, with the
        // pending-contact explanation.
        XCTAssertTrue(app.staticTexts[Fr.t(.fichePendingHint)].waitForExistence(timeout: 10), "FCH-08: pending-contact hint missing")
        XCTAssertTrue(app.staticTexts[Fr.t(.ficheEnvieInactive)].exists, "FCH-08: envie-inactive indication missing")

        // Axes remain fully editable despite the pending link: a Ressenti
        // edit takes effect (selected state + FCH-04 history event).
        let precieux = app.buttons[Fr.t(.ressentiPrecious)]
        XCTAssertTrue(precieux.waitForExistence(timeout: 5))
        if !precieux.isHittable { app.swipeUp() }
        precieux.tap()
        XCTAssertTrue(precieux.isSelected, "FCH-08: Ressenti chip did not select on a pending contact's fiche")
        XCTAssertTrue(
            app.staticTexts["\(Fr.t(.ficheAxisRessenti)) → \(Fr.t(.ressentiPrecious))"].waitForExistence(timeout: 10),
            "FCH-08: axis edit on a pending contact did not record"
        )
    }
}
