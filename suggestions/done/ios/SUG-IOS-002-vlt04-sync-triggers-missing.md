# SUG-IOS-002 — Vault writes made after onboarding never reach the server (no replay triggers)

- **Area:** ios
- **Topic:** offline
- **Impact:** high
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-10, VLT-04, ONB-05, ONB-08, FCH-01
- **Status:** implemented 2026-08-24 (PR #125). See `apps/ios/CHANGELOG.md`.

> **Rewritten 2026-08-24 for ADR-001.** The original text was written against the pre-ADR-001
> VLT-04 — *"Sync triggers: app background, post-onboarding, after any vault write burst
> (debounced ≥30s)"* — which commit `ab3f241` (2026-08-16) **deleted** from `docs/specs/FS-07-identity-vault.md`.
> ADR-001's "Backlog impact" section lists this item as **changed in meaning, not deleted**
> (*"sync triggers → cache refresh + write replay"*); this is that rewrite. The **defect below is
> unchanged and real** — only its requirement citation moved. Filed under `done/` because the
> replay triggers shipped; the durable outbox VLT-10 actually asks for did not (see *Not fixed here*).

## Problem

FS-07 **VLT-10** requires that offline writes "queue in a durable local outbox and replay in order
on reconnect". FS-01's first acceptance criterion requires that placements made in airplane mode
"sync to the server when connectivity returns (VLT-04), with no data loss".

Neither held. `VaultSync.sync()` was called from exactly one place in the iOS app —
`DoneViewModel.finish()` (`apps/ios/Sources/SwabUI/Onboarding/OnboardingViewModels.swift`) — with no
retry. Consequences:

- Every fiche edit after onboarding (`FicheViewModel.setRing/setEtat/setRessenti/toggleRole`) mutated
  the vault but was **never pushed**: the server copy stayed frozen at the post-onboarding state for
  the life of the install.
- If that one onboarding-time push failed — and offline completion is a first-class path — nothing
  ever retried it.
- `docs/qa/e2e-coverage.json` marked VLT-04 iOS `unit-covered`, but `VaultSyncTests.swift` covered
  only push/409 semantics (VLT-02) and no replay at all. The manifest over-claimed.

## What shipped

`Sources/SwabCore/Sync/SyncScheduler.swift` — an actor driving a `PendingSyncWork` protocol (never
`VaultSync` as a concrete type, so ADR-001 stage 4's outbox conforms in its place). Replay triggers:
post-onboarding, app background, and a 30 s-debounced write burst, all inert until ONB-05's
onboarding-local window closes. `Vault` announces writes through a bare `setOnPersist` closure so the
vault layer stays ignorant of the network (MAP-05).

**The triggers and the 30 s window are engineering choices, not spec text** — the current VLT-04 names
neither. They are this client's approximation of "on reconnect" while it has no reachability callback.

Review of PR #125 also produced: ONB-08 ordering (`.complete` persists *before* the push, matching
Android), backoff for a push that keeps failing identically (issue #127 makes the first push of every
new account impossible — without backoff that is an unbounded retry loop), and a fix for a write
landing during an in-flight flush being left pending with nothing scheduled.

## Not fixed here — follow-ups

- **This is not VLT-10's durable outbox.** `needsSync` is in-memory, so a session killed between a
  failed push and the next trigger loses the retry. Durability lands with ADR-001 stage 4.
- **Issue #127** — the first push cannot succeed (`upsertVault` creates a row only when
  `baseVersion === 0`; this client never sends 0). Backoff bounds the damage; it does not fix it.
  Until #127 lands, FS-01 acceptance 1 is still not met.
- **No reconnect/foreground trigger.** Android added `onAppForeground()` (SUG-AND-001); iOS has not.
- **Per-record typed writes (VLT-07/08/09)** remain whole-blob pushes until stage 4.
