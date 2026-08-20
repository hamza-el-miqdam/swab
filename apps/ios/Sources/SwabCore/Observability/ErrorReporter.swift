/// G3 (`agents/_global-directives.md`, Observability) — the single
/// error-boundary reporter every view model reports failures through
/// instead of silently swallowing them with `try?`.
///
/// `ReportedError`'s string fields carry error IDENTITY ONLY — domain,
/// operation, and a short fixed error code. They must never carry a display
/// name, an axis value, a phone hash, a token, or any other G3-banned
/// payload (see `_global-directives.md` G3's "Never log" list, which binds
/// here too even though this isn't `pino`). Call sites map real `Error`s to
/// fixed codes before reporting — never interpolate `Error.localizedDescription`
/// for a vault-domain failure; `DecodingError.dataCorrupted`'s context string
/// can embed decoded blob fragments.
import Foundation
import os

public struct ReportedError: Sendable, Equatable {
    public let domain: String
    public let operation: String
    public let errorDescription: String

    public init(domain: String, operation: String, errorDescription: String) {
        self.domain = domain
        self.operation = operation
        self.errorDescription = errorDescription
    }
}

public protocol ErrorReporter: Sendable {
    func report(_ event: ReportedError)
}

/// Production reporter — `os.Logger` at `.error`, one logger per domain
/// (`category:`) so Console.app filtering matches the reported domains.
public struct OSLogErrorReporter: ErrorReporter {
    private let subsystem: String

    public init(subsystem: String = "com.swab.ios") {
        self.subsystem = subsystem
    }

    public func report(_ event: ReportedError) {
        let logger = Logger(subsystem: subsystem, category: event.domain)
        logger.error("\(event.operation, privacy: .public) failed: \(event.errorDescription, privacy: .public)")
    }
}

/// Test/default double — call sites that don't care about observability
/// (most existing tests) don't need to thread a reporter through.
public struct NoopErrorReporter: ErrorReporter {
    public init() {}
    public func report(_ event: ReportedError) {}
}
