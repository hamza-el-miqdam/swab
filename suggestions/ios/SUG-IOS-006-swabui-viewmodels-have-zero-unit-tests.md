# SUG-IOS-006 — SwabUI has no test target: every view model is unit-untested (G2 gap hidden by SwabCore-only coverage numbers)

- **Area:** ios
- **Topic:** testing
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** ONB-02, ONB-03, ONB-05, ONB-06, FCH-01, FCH-05, MAP-05

## Problem / Opportunity

`apps/ios/Package.swift:28-35` declares a single test target, `SwabCoreTests`, depending only on `SwabCore`. Everything in `Sources/SwabUI/` — `PhoneViewModel`, `OtpViewModel`, `ContactsViewModel`, `CalibrateViewModel`, `DoneViewModel` (`Sources/SwabUI/Onboarding/OnboardingViewModels.swift`), `CarteViewModel` (`Sources/SwabUI/Carte/CarteViewModel.swift`), `FicheViewModel` (`Sources/SwabUI/Fiche/FicheViewModel.swift`) — has **zero unit tests**. The changelog's coverage claims ("SwabCore coverage 93.94%", `apps/ios/CHANGELOG.md` Wave 3 entry) are SwabCore-only; G2's 80%-on-changed-packages bar has never been applied to SwabUI. The E2E suite covers happy paths but not VM edge cases, e.g.:

- `OtpViewModel.verify()` 422-twice path: the first 422 sets `needsName = true` but a *second* 422 (name submitted, still rejected) also only re-sets `needsName` — `showError` stays false, the user gets no feedback at all (`OnboardingViewModels.swift:121-125`).
- `OtpViewModel.verify()` with `phoneHash == nil` silently returns (`:105`) — the view handles it, but the contract is untested.
- `ContactsViewModel.pick`/`addManual` failure paths (`:163-175`), `accessDenied` flow (`:154-161`).
- `CalibrateViewModel.place(ring:)` with no selection (`:215-219`), `FicheViewModel.toggleRole` add/remove round-trip (`FicheViewModel.swift:73-82`).

These VMs are `@MainActor @Observable` with injected dependencies — they are already designed for unit testing; only the target is missing.

## Implementation plan

1. In `apps/ios/Package.swift`, add:
   ```swift
   .testTarget(name: "SwabUITests", dependencies: ["SwabUI", "SwabCore"], path: "Tests/SwabUITests")
   ```
   (Name it `SwabUIViewModelTests` if `SwabUITests` collides conceptually with the XCUITest target `SwabAppUITests`; the pbxproj does not reference SPM test targets, so no project change is needed for `xcrun swift test`.)
2. Reuse existing doubles from SwabCore (`InMemoryKeyValueStore`, `InMemorySecureStore`) and add a `ScriptedHTTPTransport` (sequence of stubs — same shape as `FakeHTTPTransport` in `Tests/SwabCoreTests/ApiClientTests.swift:9-32`, which is `private`; either duplicate minimally or promote the fake into a small shared test-support target).
3. Write the test files listed below. All tests annotated `@MainActor` (the VMs are main-actor bound).
4. Fix the one real bug found while writing them: in `OtpViewModel.verify()`, when `needsName` is already true and a 422 arrives again, set `showError = true` instead of only re-setting `needsName` (`OnboardingViewModels.swift:121-122`).
5. Add coverage to the routine: document `xcrun swift test --enable-code-coverage` + `xcrun llvm-cov report` usage for both modules in `apps/ios/CHANGELOG.md` entry notes (CI wiring is devops scope — flag it in the PR description rather than editing workflows).

## Tests & acceptance criteria

- `Tests/SwabUITests/OtpViewModelTests.swift`:
  - `test_ONB02_verifySuccess_savesTokensCreatesVaultKeyAdvancesStep` — asserts keychain has both token keys and `swab.vault.key.v1` exists after verify (vault key BEFORE classification input is ONB-02's core claim).
  - `test_ONB02_first422_revealsNameField_withoutError`
  - `test_ONB02_second422WithName_showsError` (red first — currently fails, see step 4)
  - `test_ONB02_missingPhoneHash_verifyIsNoOp`
- `Tests/SwabUITests/ContactsViewModelTests.swift`: `test_ONB03_accessDenied_setsFlagAndKeepsManualPathWorking`, `test_ONB03_addManual_trimsAndClearsInput`, `test_ONB03_pick_hashesPhoneOnDevice` (assert stored `phoneHash` equals `PhoneHash.hash(raw)` and raw number is nowhere in the kv store).
- `Tests/SwabUITests/CalibrateViewModelTests.swift`: `test_ONB04_placeWithoutSelection_isNoOp`, `test_ONB05_placeWritesVaultOnly_noTransportTouched` (construct nothing network-shaped; structural assertion that the VM has no such dependency is already covered for Carte — here just assert vault state).
- `Tests/SwabUITests/FicheViewModelTests.swift`: `test_FCH01_toggleRole_addsThenRemoves`, `test_FCH05_reconfirmAndSnooze_updateNudgeVisibility` (inject dates via `FicheStaleness.shouldShowNudge` seams already present, `Sources/SwabCore/Fiche/FicheStaleness.swift:18-27`).
- `Tests/SwabUITests/CarteViewModelTests.swift`: `test_MAP05_refresh_loadsPlacedAndUnplacedPartitions`.
- Run: `cd apps/ios && xcrun swift test` — new target runs in the same invocation.

## Risks & gotchas

- `@Observable` VMs need no special test host, but they are `@MainActor` — forgetting the annotation gives confusing concurrency errors under strict checking.
- Don't test SwiftUI view bodies here; keep it at the VM contract level (views stay covered by the XCUITest suite).
- The 422 fix changes user-visible behavior slightly; keep `OtpView`'s existing error copy (`otp.error`) — no new French copy needed.
