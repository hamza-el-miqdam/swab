# SUG-AND-001 — VLT-04 sync triggers missing: vault is pushed exactly once, at onboarding Done

- **Area:** android
- **Topic:** offline
- **Impact:** high
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** VLT-04, VLT-02, FCH-01

## Problem / Opportunity

FS-07 VLT-04 (docs/specs/FS-07-identity-vault.md:35) requires three sync triggers: "app background, post-onboarding, after any vault write burst (debounced ≥30s)". FS-03's acceptance criteria (docs/specs/FS-03-contact-card.md:31) add: "Given an axis edit offline, when connectivity returns, then vault sync reconciles without data loss."

The Android app implements only ONE of these. `container.vaultSync.syncVault()` is called exactly once in the whole production codebase — inside DoneScreen's `onFinish` at /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/MainActivity.kt:174, wrapped in `runCatching` with no retry. Verified by grep: the only production call sites of `syncVault` are MainActivity.kt:174 and the definition in VaultSync.kt:18.

Consequences:

- Every FCH-01 axis edit made on the fiche (FicheViewModel.kt:65-93 → Vault.setRing/setRoles/setEtat/setRessenti/recordAxisEdit) stays local forever; the server blob is permanently stale after onboarding.
- If the one Done-screen push fails (offline onboarding — explicitly a first-class flow per FS-01 acceptance, docs/specs/FS-01-onboarding.md:32), nothing ever retries: "sync as an encrypted blob when connectivity returns" never happens.
- Secondary bug in the same block (MainActivity.kt:172-176): `setStep(OnboardingStep.COMPLETE)` runs AFTER `syncVault()` inside the same coroutine. `HttpUrlConnectionTransport` has 10s connect + 10s read timeouts (HttpUrlConnectionTransport.kt:24-25), so killing the app within up to ~20s after tapping « Voir ma carte » resumes at the DONE step again (ONB-08 regression window).

## Implementation plan

1. Create `apps/android/app/src/main/kotlin/com/swab/android/vault/VaultSyncScheduler.kt`:
   ```kotlin
   class VaultSyncScheduler(
       private val vaultSync: VaultSync,
       private val scope: CoroutineScope,
       private val debounceMillis: Long = 30_000L,
       private val nowProvider: () -> Long = System::currentTimeMillis,
   ) {
       private val mutex = Mutex()
       private var pendingJob: Job? = null

       /** VLT-04 "after any vault write burst (debounced >=30s)". */
       fun onVaultWrite() { /* cancel pendingJob, launch delay(debounceMillis) then trySync() */ }

       /** VLT-04 "app background" + retry-on-reconnect entry point. */
       fun syncNow() { /* cancel pendingJob, launch trySync() immediately */ }

       private suspend fun trySync() { runCatching { vaultSync.syncVault() } }
   }
   ```
   Keep it free of Android imports so it is JVM-testable (same convention as VaultSync).
2. Wire it in `AppContainer` (AppContainer.kt): `val vaultSyncScheduler = VaultSyncScheduler(vaultSync, CoroutineScope(SupervisorJob() + Dispatchers.Default))`.
3. Notify on writes. Do NOT make `Vault` import network code (would break CarteOfflineStructuralTest / FicheOfflineStructuralTest, see FicheViewModel.kt:24-26). Instead add an optional callback to `Vault`'s constructor: `private val onPersist: () -> Unit = {}`, invoked at the end of `persist(...)` (Vault.kt:110-115). AppContainer passes `{ vaultSyncScheduler.onVaultWrite() }`. The vault package still never imports `com.swab.android.network`.
4. App-background trigger: in `MainActivity.onCreate`, add a `DefaultLifecycleObserver` on `ProcessLifecycleOwner` is NOT available (no lifecycle-process dep); simplest no-new-dependency option: override `onStop()` in MainActivity and call `container.vaultSyncScheduler.syncNow()`. (Alternatively justify `androidx.lifecycle:lifecycle-process` in the PR per G4; the override is dependency-free.)
5. Fix the Done ordering (MainActivity.kt:171-179): persist the step FIRST, then fire sync without blocking:
   ```kotlin
   scope.launch {
       container.onboardingStateStore.setStep(OnboardingStep.COMPLETE)
       container.vaultSyncScheduler.syncNow()
   }
   navController.navigate(Routes.CARTE)
   ```
6. Retry-on-reconnect (the FS-03 offline acceptance): a full ConnectivityManager listener is optional for POC; at minimum `syncNow()` from `onStart()` when a push has previously failed (keep a `@Volatile var lastSyncFailed` flag inside the scheduler). State honestly in the PR if you defer the ConnectivityManager callback.

## Tests & acceptance criteria

- New `apps/android/app/src/test/kotlin/com/swab/android/vault/VaultSyncSchedulerTest.kt` (JVM, `runTest` + virtual time):
  - `test_VLT04_writeBurst_debounced_singlePushAfter30s`: call `onVaultWrite()` 5× within 10s virtual time; assert the scripted transport (reuse `ScriptedTransport` pattern from VaultSyncTest.kt:17-24) received exactly one POST after advancing 30s.
  - `test_VLT04_syncNow_flushesImmediately_cancellingPendingDebounce`.
  - `test_VLT04_failedSync_doesNotThrow_and_marksLastSyncFailed`.
- New `VaultTest` case `test_VLT04_persist_invokesOnPersistCallback`.
- Structural guard stays green: `CarteOfflineStructuralTest` / `FicheOfflineStructuralTest` must still pass (no network import added to vault/carte/fiche packages).
- Run: `cd apps/android && ./gradlew test`; then full `scripts/e2e-android.sh` (existing 16 tests must stay green; the Done-screen flow changes ordering, so watch `test_ONB01_08_happyPath_welcomeToCarte`).

## Risks & gotchas

- Privacy invariant: the scheduler must only ever touch `VaultSync` (ciphertext); never add classification fields to any new type (G1, ApiClient.kt:9-16 header).
- Debounce scope must survive ViewModel teardown — hence AppContainer-owned scope, not `viewModelScope`.
- Do not sync on every keystroke-level write: `recordAxisEdit` fires per chip tap; the 30s debounce is what VLT-04 explicitly asks for.
- Keep `runCatching` semantics: offline sync failure must stay silent in UI (no error banner — product ethos, nothing alarming).
