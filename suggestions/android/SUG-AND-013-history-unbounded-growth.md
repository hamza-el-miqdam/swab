# SUG-AND-013 — Vault history grows without bound: every chip tap appends forever against a 1 MB server quota

- **Area:** android
- **Topic:** offline
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** FCH-04, VLT-03

## Problem / Opportunity

`Vault.recordAxisEdit` (/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/vault/Vault.kt:164-176) appends a `VaultHistoryEvent` on every single axis edit (`data.history + event`) and nothing anywhere ever removes one. The 12-month product window is applied only at read time, in `FicheViewModel.refresh()` (FicheViewModel.kt:59: `.filter { now - it.at <= TWELVE_MONTHS_MILLIS }`) — the underlying list keeps everything since install.

Each event serializes to roughly 150-200 bytes of JSON (UUID id + contactId + axis + French summary + timestamp, Vault.kt:55-62). Every chip tap on the fiche is an edit (FicheScreen chips call setIntimite/setRoles/setEtat/setRessenti directly, FicheScreen.kt:87-96, each recording history via FicheViewModel.kt:111-114). FS-07 VLT-03 (docs/specs/FS-07-identity-vault.md:34) caps the server blob at ≤ 1 MB per user — an active user with many contacts and years of re-tags will hit the quota, at which point vault pushes start failing with no client-side handling (ApiClient.pushVault throws `ApiError` on non-2xx/409, ApiClient.kt:86). Encryption also gets linearly slower since the whole blob re-encrypts per persist (Vault.persist, Vault.kt:110-115).

FCH-04 only requires 12 months of history ("over 12 months, newest first" — docs/specs/FS-03-contact-card.md:22), so pruning older events loses nothing the product promises.

## Implementation plan

1. Add a retention constant in `Vault` (Vault.kt companion, next to SNOOZE_MILLIS at line 82): `const val HISTORY_RETENTION_MILLIS: Long = 365L * 24 * 60 * 60 * 1000` with a KDoc pointing at FCH-04's 12-month window. (FicheViewModel has its own `TWELVE_MONTHS_MILLIS` at FicheViewModel.kt:19 — have it reference `Vault.HISTORY_RETENTION_MILLIS` instead so the two can't drift.)
2. Prune at append time, inside `recordAxisEdit`'s existing lock (Vault.kt:164-176):
   ```kotlin
   val cutoff = at - HISTORY_RETENTION_MILLIS
   val prunedHistory = data.history.filter { it.at >= cutoff }
   val next = data.copy(contacts = updatedContacts, history = prunedHistory + event)
   ```
   Append-time pruning is enough — the list only grows via this one method, so it stays bounded without a background job.
3. Also drop history rows whose contact no longer exists? No contact deletion exists yet (no `removeContact` in Vault) — leave a one-line comment noting future deletion must prune matching history, and do nothing now.
4. CHANGELOG entry (G5), noting the retention now matches FCH-04's read window.

## Tests & acceptance criteria

JVM, extend `VaultTest` (apps/android/app/src/test/kotlin/com/swab/android/vault/VaultTest.kt), run `cd apps/android && ./gradlew test`:

- `FCH-04 recordAxisEdit prunes events older than 12 months`: add contact; `recordAxisEdit(..., at = 0L)`; `recordAxisEdit(..., at = Vault.HISTORY_RETENTION_MILLIS + 1_000L)`; assert `getHistory` returns exactly the second event.
- `FCH-04 events inside the 12-month window are never pruned`: two edits 1 day apart, both retained.
- `VLT-03 blob size stays bounded under repeated edits`: loop 500 `recordAxisEdit` calls all stamped inside a moving window where the cutoff advances; assert `getHistory(contact.id).size` ≤ the count within retention (sanity: strictly less than 500 when timestamps span > 12 months).
- Existing history tests must stay green — `FCH-04 getHistory returns newest first and only for the requested contact` (VaultTest.kt:136-151) uses `at = 1L..3L` (same epoch window, nothing pruned) so it is unaffected; verify.

## Risks & gotchas

- Pruning must happen inside the same `mutex.withLock`/single-persist transaction as the append (the atomicity note at Vault.kt:157-163) — do not add a second lock acquisition.
- Use the caller-supplied `at` (already the FicheViewModel `nowProvider` seam, FicheViewModel.kt:38) as "now" for the cutoff, keeping the method deterministic and testable — no direct `System.currentTimeMillis()` inside Vault.
- Unknown-field tolerance: pruning changes content, not shape; the `ignoreUnknownKeys` decode contract (Vault.kt:85) and the legacy-blob E2E (`LegacyVaultCompatE2ETest` — seeds a pre-FS-03 blob with NO history array, E2ESeedHooks.kt:71-72) are unaffected, but run `scripts/e2e-android.sh` to confirm.
