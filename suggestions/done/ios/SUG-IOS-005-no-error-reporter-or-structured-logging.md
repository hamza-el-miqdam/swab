# SUG-IOS-005 — G3 gap: no error-boundary reporter, no logging seam — every failure is `try?`-swallowed

- **Area:** ios
- **Topic:** architecture
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** n/a (G3 directive)

## Problem / Opportunity

G3 (`agents/_global-directives.md`, Observability) requires "Mobile/web report errors via a single error-boundary reporter" and structured, privacy-safe logging. The iOS app has neither: grep over `Sources/` and `App/` finds zero `Logger`/`os_log`/`print` and no reporter abstraction. Every failure path is discarded:

- `try? await vaultSync.sync()` (`Sources/SwabUI/Onboarding/OnboardingViewModels.swift:252`)
- `try? await vault.setRing(...)` and every calibrate/fiche setter (`OnboardingViewModels.swift:217,223,229`; `Sources/SwabUI/Fiche/FicheViewModel.swift:58,63,68,80,85,90`)
- `try? await vault.addContact(...)` (`OnboardingViewModels.swift:165,171`)
- `try? data.write(...)` in the persistence layer (`Sources/SwabCore/Storage/KeyValueStore.swift:54-57`)

A dropped vault write, failed sync, or failed disk persist is currently unobservable both to the user and to a developer attached to the device. This blocks diagnosing exactly the classes of bug the audit found (SUG-IOS-002/003/004/009).

## Implementation plan

1. Add `Sources/SwabCore/Observability/ErrorReporter.swift`:
   - `public protocol ErrorReporter: Sendable { func report(_ event: ReportedError) }`
   - `public struct ReportedError: Sendable { let domain: String; let operation: String; let errorDescription: String }` — **string fields only ever carry error identity, never payloads**: no display names, no axis values, no phone hashes, no tokens (G3 ban list).
   - `public struct OSLogErrorReporter: ErrorReporter` using `os.Logger(subsystem: "com.swab.ios", category: domain)` at `.error`; `public struct NoopErrorReporter` for tests.
2. Thread one reporter instance from the composition root (`App/SwabApp.swift` `RootView.init`, near `App/SwabApp.swift:106-130`) into each view model via init parameters (matches the existing DI style — every VM already takes its dependencies explicitly).
3. Replace the `try?` sites listed above with `do/catch { reporter.report(...) }`, preserving current user-facing behavior except where SUG-IOS-004 adds visible states. Vault-layer internals stay throwing; only the VM boundary reports.
4. Add a lightweight duration signpost for sync (G3 metrics-in-spirit): `os.signpost` or a reported `info` event around `VaultSync.sync()` with duration only — vendor-neutral, no new deps (G4).

## Tests & acceptance criteria

- `Tests/SwabCoreTests/ErrorReporterPrivacyTests.swift`:
  - `test_G3_reportedErrors_neverContainClassificationVocabulary` — build `ReportedError`s from a forced `VaultError.unreadable` and a forced sync failure through the real code paths (fake transport/corrupt store), capture with a `RecordingErrorReporter`, assert none of the captured strings contain any `FicheVocabulary` value, ring label, or the seeded display name (reuse the string list technique from `Tests/SwabCoreTests/FichePrivacyInvariantTests.swift:32-37`).
  - `test_G3_syncFailure_isReportedOnce` — `FakeVaultSyncApi.alwaysConflict` → exactly one reported event, domain `"vault.sync"`.
- Run: `cd apps/ios && xcrun swift test`. E2E suite unchanged.

## Risks & gotchas

- The reporter is precisely where a privacy leak would be easiest to introduce later — the privacy test above is the point of the PR, not an afterthought; wire it to real error objects, not hand-built fixtures.
- `Error.localizedDescription` on decoding errors can embed decoded fragments (`DecodingError.dataCorrupted` context strings) — map vault errors to fixed short codes (`"unreadable"`, `"blobUnavailable"`) instead of interpolating `localizedDescription` for vault-domain errors.
- Keep `CarteViewModel.swift` free of banned tokens (`URLSession`, `ApiClient`, `HTTPTransport`, `VaultSync`) including in comments (`Tests/SwabCoreTests/CarteOfflineInvariantTests.swift:17`).
