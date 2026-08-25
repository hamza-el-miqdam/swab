# SUG-AND-001 — Vault writes made after onboarding never reach the server (no replay triggers)

- **Area:** android
- **Topic:** offline
- **Impact:** high
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** VLT-10, VLT-04, ONB-05, ONB-08, FCH-01
- **Status:** implemented 2026-08-25 (PR #126). See `apps/android/CHANGELOG.md`.

> **Rewritten 2026-08-25 for ADR-001.** The original text was written against the pre-ADR-001
> VLT-04 — *"Sync triggers: app background, post-onboarding, after any vault write burst
> (debounced ≥30s)"* — which commit `ab3f241` (2026-08-16) **deleted** from
> `docs/specs/FS-07-identity-vault.md`; it also cited `FS-07:35`, a line that has not been VLT-04
> since that rewrite. ADR-001's "Backlog impact" lists this item as **changed in meaning, not
> deleted** (*"sync triggers → cache refresh + write replay"*); this is that rewrite, mirroring the
> iOS twin SUG-IOS-002. The **defect below is unchanged and real** — only its requirement citation
> moved. Filed under `done/` because the replay triggers shipped; the durable outbox VLT-10 actually
> asks for did not (see *Not fixed here*).

## Problem

FS-07 **VLT-10** requires that offline writes "queue in a durable local outbox and replay in order
on reconnect". FS-01's first acceptance criterion requires that placements made in airplane mode
"sync to the server when connectivity returns, with no data loss".

Neither held. `container.vaultSync.syncVault()` was called from exactly one place in the whole
production codebase — `DoneScreen`'s `onFinish` in `MainActivity.kt`, wrapped in `runCatching` with
no retry. Consequences:

- Every FCH-01 axis edit on the fiche (`FicheViewModel` → `Vault.setRing/setRoles/setEtat/setRessenti/recordAxisEdit`)
  mutated the local vault but was **never pushed**: the server copy stayed frozen at the
  post-onboarding state for the life of the install.
- If that one onboarding-time push failed — and offline completion is a first-class path — nothing
  ever retried it.
- Secondary defect in the same block: `setStep(OnboardingStep.COMPLETE)` ran **after** `syncVault()`
  in the same coroutine, and `HttpUrlConnectionTransport` allows 10s connect + 10s read, so killing
  the app within ~20s of « Voir ma carte » resumed on the completion screen instead of the map
  (ONB-08).

## What shipped

- `sync/SyncScheduler.kt` (+ `PendingSync`) — replay scheduling decoupled from *what* is replayed,
  so ADR-001 stage 4's outbox can implement the same interface: post-onboarding, app background,
  foreground retry, and a debounced write burst, with backoff on repeated identical failures.
  **The specific triggers and the 30 s window are engineering choices, not spec text** — the current
  VLT-04 names neither.
- `Vault.onPersist` — the vault announces its own writes without importing the network or sync layer.
- One `AppContainer` per **process** (on `SwabApplication`). Per-Activity containers meant a rotation
  left the surviving ViewModels writing to a dead scheduler while the lifecycle triggers drove a new,
  permanently-empty one — the same defect behind a config change.
- `OnboardingViewModel.complete()` persists `COMPLETE` **before** the post-onboarding push (ONB-08).
- ONB-05 holds: nothing leaves the device until the persisted step is `COMPLETE`.

## Not fixed here

- **The durable outbox itself.** The queue counters live in memory; a process death between a failed
  push and the next trigger still loses the cue. Mitigated by assuming pending work at launch when
  onboarding is already complete (mirrors iOS), which is a stopgap, not durability. Real fix: ADR-001
  stage 4 (VLT-10).
- **Issue #127** — the first push of a new account can never succeed (base-version mismatch on both
  platforms, plus an Android-only response-decode defect). Until that lands, every trigger here ends
  in a failed push, so the user-visible symptom persists even though the scheduling is correct.
  Pinned by `test_VLT10_againstTheRealServerResponseShape_thePushStillFails_issue127`.
- **No `ConnectivityManager` callback** — reconnect is approximated by the foreground trigger.
