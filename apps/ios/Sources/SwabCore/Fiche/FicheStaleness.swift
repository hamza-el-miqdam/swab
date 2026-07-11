/// FCH-05 — staleness nudge timing, pure/testable independent of the vault
/// or any view. Never a modal, never blocking: this only answers "should
/// the discreet prompt render right now", the caller decides how.
import Foundation

public enum FicheStaleness {
    /// ⚠️ ASSUMPTION (spec explicitly flags this default as unresolved,
    /// FCH-05): six months of no axis change before the discreet nudge.
    public static let defaultStalenessInterval: TimeInterval = 60 * 60 * 24 * 30 * 6

    /// FCH-05 / acceptance criterion: "À revoir plus tard" re-eligibility
    /// after 30 days.
    public static let snoozeInterval: TimeInterval = 60 * 60 * 24 * 30

    /// - `lastAxisChangeAt == nil` (never classified at all) never nudges —
    ///   there is nothing stale about a relation that was never tagged.
    /// - A still-active snooze suppresses the nudge regardless of staleness.
    public static func shouldShowNudge(
        lastAxisChangeAt: Date?,
        snoozedUntil: Date?,
        now: Date = Date(),
        stalenessInterval: TimeInterval = defaultStalenessInterval
    ) -> Bool {
        guard let lastAxisChangeAt else { return false }
        if let snoozedUntil, now < snoozedUntil { return false }
        return now.timeIntervalSince(lastAxisChangeAt) >= stalenessInterval
    }
}
