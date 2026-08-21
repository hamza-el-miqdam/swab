# SUG-IOS-007 — Fiche history grows unbounded inside the vault blob (VLT-03's 1 MB quota will eventually reject syncs)

- **Area:** ios
- **Topic:** offline
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** FCH-04, VLT-03

## Problem / Opportunity

Every fiche axis edit and every reconfirm inserts a `FicheHistoryEvent` at the front of `contact.history` and nothing ever removes one (`apps/ios/Sources/SwabCore/Vault/Vault.swift:253-256` in `recordAxisEdit`, `:272` in `reconfirmFicheStaleness`). FCH-04 only ever *displays* 12 months (`FicheViewModel.recentHistory` filters at read time, `apps/ios/Sources/SwabUI/Fiche/FicheViewModel.swift:30-35`), but storage retains everything forever.

FS-07 VLT-03 caps the server-side blob at ≤1 MB per user (`docs/specs/FS-07-identity-vault.md:34`). Each history event serializes to ~150+ bytes (UUID id + date + nested kind payload); an active user tagging a few hundred contacts over years will hit the quota, at which point `POST /vault` fails and — combined with today's silent error handling (SUG-IOS-005) — sync dies invisibly. Pruning at write time is cheap and spec-aligned: FCH-04's product surface is defined as 12 months.

## Implementation plan

1. In `Vault.swift`, add a private helper on the actor:
   ```swift
   private func prunedHistory(_ history: [FicheHistoryEvent], now: Date) -> [FicheHistoryEvent] {
       let cutoff = Calendar.current.date(byAdding: .month, value: -12, to: now) ?? .distantPast
       return history.filter { $0.date >= cutoff }
   }
   ```
2. Apply it in the two write paths after inserting the new event: in `recordAxisEdit` (`Vault.swift:239-258`) and `reconfirmFicheStaleness` (`:264-274`), set `data.contacts[index].history = prunedHistory(data.contacts[index].history, now: now)`.
3. Keep read-time filtering in `FicheViewModel.recentHistory` unchanged (it also handles device-clock edge cases and legacy blobs that were never pruned).
4. Do NOT prune `.relationshipEvent` differently for now — FS-05 doesn't exist yet and FCH-04 scopes the whole feed to 12 months; note in the changelog entry that match-event retention is re-decidable when FS-05 lands.

## Tests & acceptance criteria

- Additions to `Tests/SwabCoreTests/FicheVaultTests.swift`:
  - `test_FCH04_historyOlderThanTwelveMonths_isPrunedOnNextWrite` — seed a contact whose history contains a 13-month-old event (build `VaultContact` directly with a back-dated `FicheHistoryEvent`, persist via a first edit), perform `setFicheEtat`, assert the old event is gone and the new one present.
  - `test_FCH04_historyWithinTwelveMonths_isKeptOnWrite` — an 11-month-old event survives an edit.
  - `test_VLT03_hundredEdits_historyStaysBounded` — loop 100 `setFicheEtat` calls same-day; history count == 100 is fine (all recent), but assert blob byte length stays well under a sanity ceiling to lock the mechanism's existence (optional; the two date tests are the contract).
- Run: `cd apps/ios && xcrun swift test`. E2E `test_FCH04_axisEdit_appendsHistoryEvent_newestFirst` must stay green (recent events unaffected).

## Risks & gotchas

- Pruning must happen inside the actor's single mutate-then-persist path so it rides the same encryption/persist transaction — never as a separate read-modify-write.
- A device with a badly wrong clock (future date) could prune everything; acceptable for POC, but keep read-time filtering as the display source of truth so the UI degrades identically.
- Cross-platform: Android stores history globally (`apps/android/.../vault/Vault.kt:66-69`) and will need its own equivalent — mention it in the PR so the android-specialist mirrors the retention rule (and see SUG-IOS-001 for the shape divergence itself).
