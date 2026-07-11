/// FCH-05 — pure timing logic tests, independent of the vault/UI.
import Foundation
import XCTest

@testable import SwabCore

final class FicheStalenessTests: XCTestCase {
    private let sixMonthsAgo = Date().addingTimeInterval(-FicheStaleness.defaultStalenessInterval - 1)
    private let oneDayAgo = Date().addingTimeInterval(-60 * 60 * 24)

    func test_FCH05_neverClassified_noNudge() {
        XCTAssertFalse(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: nil, snoozedUntil: nil)
        )
    }

    func test_FCH05_recentChange_noNudge() {
        XCTAssertFalse(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: oneDayAgo, snoozedUntil: nil)
        )
    }

    func test_FCH05_staleWithNoSnooze_showsNudge() {
        XCTAssertTrue(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: sixMonthsAgo, snoozedUntil: nil)
        )
    }

    func test_FCH05_staleButActivelySnoozed_noNudge() {
        let snoozedUntil = Date().addingTimeInterval(60 * 60 * 24) // 1 day in the future
        XCTAssertFalse(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: sixMonthsAgo, snoozedUntil: snoozedUntil)
        )
    }

    /// Acceptance criterion: re-eligible after 30 days.
    func test_FCH05_snoozeExpired_showsNudgeAgain() {
        let expiredSnooze = Date().addingTimeInterval(-1) // snooze window already passed
        XCTAssertTrue(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: sixMonthsAgo, snoozedUntil: expiredSnooze)
        )
    }

    func test_FCH05_exactlyAtStalenessBoundary_showsNudge() {
        let now = Date()
        let lastChange = now.addingTimeInterval(-FicheStaleness.defaultStalenessInterval)
        XCTAssertTrue(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: lastChange, snoozedUntil: nil, now: now)
        )
    }

    func test_FCH05_justUnderStalenessBoundary_noNudge() {
        let now = Date()
        let lastChange = now.addingTimeInterval(-FicheStaleness.defaultStalenessInterval + 60)
        XCTAssertFalse(
            FicheStaleness.shouldShowNudge(lastAxisChangeAt: lastChange, snoozedUntil: nil, now: now)
        )
    }

    /// ASSUMPTION documented in FicheStaleness.swift: default is six months.
    func test_FCH05_defaultIntervalIsSixMonths() {
        let sixMonthsInSeconds: TimeInterval = 60 * 60 * 24 * 30 * 6
        XCTAssertEqual(FicheStaleness.defaultStalenessInterval, sixMonthsInSeconds)
    }

    func test_FCH05_snoozeIntervalIsThirtyDays() {
        let thirtyDays: TimeInterval = 60 * 60 * 24 * 30
        XCTAssertEqual(FicheStaleness.snoozeInterval, thirtyDays)
    }
}
