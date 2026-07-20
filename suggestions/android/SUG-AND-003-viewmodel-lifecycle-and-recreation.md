# SUG-AND-003 — ViewModels are hand-constructed in composition: two are recreated on EVERY recomposition, none survive rotation

- **Area:** android
- **Topic:** architecture
- **Impact:** high
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-02, ONB-08, MAP-02

## Problem / Opportunity

Three distinct problems, all in /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/MainActivity.kt:

1. **VMs constructed without `remember`** — MainActivity.kt:151 (`val contactsViewModel = ContactsViewModel(container.vault)`) and MainActivity.kt:162 (`val calibrateViewModel = CalibrateViewModel(container.vault)`) run the constructor on every recomposition of those destinations. Each construction fires `init { refresh() }` (ContactsViewModel.kt:24-26, CalibrateViewModel.kt:27-29) — a fresh vault read per recomposition — and resets `CalibrateViewModel._selectedId` to null, so any recomposition while the user has a contact selected silently drops the selection. All sibling screens use `remember`, so these two are plainly accidental.

2. **No config-change survival.** All VMs extend `androidx.lifecycle.ViewModel` (SignupViewModel.kt:34-40, OnboardingViewModel.kt:15, CarteViewModel.kt:22, FicheViewModel.kt:35-39) but are created with plain `remember { }` (MainActivity.kt:110, 128, 202, 246-253) instead of the `viewModel()` composable — the import at MainActivity.kt:20 (`androidx.lifecycle.viewmodel.compose.viewModel`) is present but never used. On rotation/dark-mode change the Activity is recreated, the whole tree recomposes from scratch, and every VM is rebuilt: `SignupViewModel`'s memory-only `PendingSignup.pendingPhoneHash` (PendingSignup.kt:10-12) is lost, so rotating the phone on the OTP screen lands the user on the « Reprenons depuis ton numéro » dead end (OtpScreen.kt:21-28). The comment in OnboardingState.kt:10-13 justifies re-asking after *process death* — rotation is not process death and this is a real mid-signup UX regression. `viewModelScope` also never gets `onCleared()` since these instances are not owned by a ViewModelStore.

3. **Two sources of truth for the onboarding step.** `OnboardingViewModel.advanceTo` (OnboardingViewModel.kt:26-31) updates both the store and its `_step` flow, but the CONTACTS/CALIBRATE/DONE transitions bypass it and write the store directly (`scope.launch { container.onboardingStateStore.setStep(...) }`, MainActivity.kt:156, 166, 175), leaving `OnboardingViewModel.step` stale at PHONE for the rest of the session. Harmless today only because `NavHost(startDestination=...)` is read once; any future consumer of `step` will read wrong data.

## Implementation plan

1. Add factories and switch to `viewModel()`:
   ```kotlin
   val onboardingViewModel: OnboardingViewModel = viewModel {
       OnboardingViewModel(container.onboardingStateStore)
   }
   ```
   (The `viewModel { }` factory-lambda overload is in lifecycle-viewmodel-compose 2.8.4, already a dependency — build.gradle.kts:115.) Do the same for `SignupViewModel` (replacing `rememberSignupViewModel`, MainActivity.kt:246-253) and `CarteViewModel` (MainActivity.kt:128). These are created at `SwabNavHost` scope, so they are scoped to the Activity's ViewModelStore and survive recreation — preserving the existing hoisting fixes documented at MainActivity.kt:113-127.
2. `ContactsViewModel` / `CalibrateViewModel` (MainActivity.kt:151, 162): scope them to their `NavBackStackEntry` — inside `composable {}`, plain `viewModel { ContactsViewModel(container.vault) }` already uses the entry as owner. This fixes both the per-recomposition reconstruction and gives config-change survival.
3. `FicheViewModel` (MainActivity.kt:202): `viewModel(key = contactId) { FicheViewModel(container.vault, contactId) }` — keeps the per-contact identity that `remember(contactId)` provided.
4. Route the step writes through the ViewModel: replace the three direct `onboardingStateStore.setStep(...)` calls (MainActivity.kt:156, 166, 175) with `onboardingViewModel.advanceTo(...)`, deleting the local `scope.launch` wrappers (advanceTo already launches in `viewModelScope`).
5. Delete `rememberSignupViewModel` and the now-unneeded `rememberCoroutineScope` if unused; keep the explanatory hoisting comments, updating them to reference `viewModel()` scoping.
6. CHANGELOG entry (G5).

## Tests & acceptance criteria

- Extend `ActivityRecreationSmokeTest` (ActivityRecreationSmokeTest.kt:32) with `test_ONB02_recreateAtOtp_pendingPhoneHashSurvives`: drive Welcome→Phone→submit, wait for the OTP screen (`waitUntilTextExists("Code (dev)", substring = true)` — E2EFlows.kt:236), call `scenario.recreate()`, assert the OTP input is still shown and `Fr.OTP_MISSING_PHONE` is NOT present.
- New JVM test `OnboardingViewModelTest.test_ONB08_advanceTo_keepsStepFlowInSyncWithStore` asserting `step.value` equals the persisted store value after each transition.
- Full suites: `cd apps/android && ./gradlew test` and `scripts/e2e-android.sh` — the 16 existing E2E tests, especially `test_navigationStateLoss_phoneHashSurvivesPhoneToOtpTransition` (OnboardingE2ETest.kt:72), must stay green.

## Risks & gotchas

- Keep VM constructor injection (no Hilt — G4 decision documented in AppContainer.kt:18-22); `viewModel { }` factory lambdas preserve that.
- Scoping Contacts/Calibrate VMs to the backstack entry means their state now survives while the entry is on the stack — verify the calibrate flow still starts unselected when re-entered after popping.
- `CarteViewModel` must stay Activity-scoped (not per-entry) or the tab-switch teardown bug described at MainActivity.kt:122-127 returns.
- `E2ESeedHooks.apply` (MainActivity.kt:93) must keep running before any VM construction.
