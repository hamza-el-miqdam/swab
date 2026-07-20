# SUG-IOS-002 — VLT-04 sync triggers are not implemented: vault syncs exactly once, at end of onboarding

- **Area:** ios
- **Topic:** offline
- **Impact:** high
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-04, VLT-02, FCH-01, ONB-05

## Problem / Opportunity

FS-07 VLT-04 (`docs/specs/FS-07-identity-vault.md:35`) requires sync on: app background, post-onboarding, and after any vault write burst (debounced ≥30s). FS-03's acceptance criterion (`docs/specs/FS-03-contact-card.md:31`) requires that an offline axis edit reconciles "when connectivity returns".

In the iOS app, `VaultSync.sync()` is called from exactly one place: `DoneViewModel.finish()` (`apps/ios/Sources/SwabUI/Onboarding/OnboardingViewModels.swift:252`, `try? await vaultSync.sync()`), wired in `App/SwabApp.swift:192`. Grep confirms no other call site. Consequences:

- Every fiche edit after onboarding (`FicheViewModel.setRing/setEtat/setRessenti/toggleRole`, `apps/ios/Sources/SwabUI/Fiche/FicheViewModel.swift:57-81`) mutates the vault but is **never pushed to the server** for the rest of the app's life — the server copy is permanently frozen at the post-onboarding state.
- If the one onboarding-time sync fails (offline completion is a first-class path per FS-01 acceptance 1), there is no retry ever.
- `docs/qa/e2e-coverage.json` marks VLT-04 iOS as `unit-covered`, but `Tests/SwabCoreTests/VaultSyncTests.swift` only covers push/409 semantics (VLT-02), not any trigger — the manifest over-claims.

## Implementation plan

1. Add `Sources/SwabCore/Vault/VaultSyncScheduler.swift`: an `actor VaultSyncScheduler` owning a `VaultSync`, with:
   - `func noteVaultDidChange()` — records `Date()`; starts (or keeps) a debounce `Task` that sleeps until 30s have passed since the last change, then calls `syncNow()`.
   - `func appDidEnterBackground()` — cancels the debounce and calls `syncNow()` immediately.
   - `func syncNow() async` — calls `try await vaultSync.sync()`, swallows-but-records the error (`private(set) var lastError`), and marks `needsSync = true` on failure so the next trigger retries.
   - Inject a `now: @Sendable () -> Date` and a `sleep: @Sendable (TimeInterval) async throws -> Void` seam for tests (default `Task.sleep`).
2. Have the vault announce writes without coupling `Vault` to networking (preserve the MAP-05 layering): add an `AsyncStream<Void>`-based `public var changes` on `Vault`, or simpler, a `public var onPersist: (@Sendable () -> Void)?` set once by the composition root. Fire it at the end of `Vault.persist(_:)` (`Sources/SwabCore/Vault/Vault.swift:161-170`). Do NOT import anything into `CarteViewModel` — `CarteOfflineInvariantTests` scans it for `VaultSync` (`Tests/SwabCoreTests/CarteOfflineInvariantTests.swift:17`).
3. In `App/SwabApp.swift` `RootView`: create the scheduler next to `vaultSync` (`App/SwabApp.swift:129`), wire `vault.onPersist = { Task { await scheduler.noteVaultDidChange() } }`, and add `@Environment(\.scenePhase)` handling (`.onChange(of: scenePhase)` on the root `NavigationStack`) that calls `scheduler.appDidEnterBackground()` when phase becomes `.background`. Only schedule after onboarding step is `.complete` (or after `.done`), so no request fires before ONB-05's onboarding-local guarantee window closes.
4. Keep `DoneViewModel.finish()`'s explicit sync (post-onboarding trigger) but route it through the scheduler so failure sets `needsSync`.
5. Update `docs/qa/e2e-coverage.json` VLT-04 iOS entry to reference the new unit tests (still `unit-covered`, now truthfully) in the same PR.

## Tests & acceptance criteria

- `Tests/SwabCoreTests/VaultSyncSchedulerTests.swift` (all with fake clock/sleep + the existing `FakeVaultSyncApi` pattern from `VaultSyncTests.swift`):
  - `test_VLT04_writeBurst_debouncedToSingleSyncAfterThirtySeconds` — three `noteVaultDidChange()` within 30s → exactly one push.
  - `test_VLT04_backgroundTrigger_syncsImmediately`.
  - `test_VLT04_failedSync_retriesOnNextTrigger` — first push throws, next trigger pushes again.
  - `test_VLT04_noSyncBeforeAnyChange` — scheduler idle → zero pushes.
- Keep `FichePrivacyInvariantTests` green — the scheduler must reuse `VaultSync` so the wire body stays exactly `{blob, version}`.
- Run: `cd apps/ios && xcrun swift test`; then full `scripts/e2e-ios.sh` (13 E2E tests must stay green — watch `test_backgroundForeground_onCarte_doesNotCrash`, which now triggers a real background sync against the live API).

## Risks & gotchas

- Keychain access uses `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` (`Sources/SwabCore/Identity/SecureStore.swift:89`) — a background sync that runs after the device locks can fail to read the session token; treat that as a retryable failure, never fatal.
- Do not add `VaultSync`/`URLSession` references to `CarteViewModel.swift` or its comments — the source-scan test fails on the literal token even in comments (documented gotcha in `apps/ios/CHANGELOG.md` Wave 2 entry).
- Debounce task must be cancelled/restarted per change, not accumulated, or rapid edits leak tasks.
