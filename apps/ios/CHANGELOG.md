# apps/ios — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

> Entries before 2026-08-15 are archived in [../../docs/archive/ios-CHANGELOG-pre-2026-08-15.md](../../docs/archive/ios-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.


## 2026-08-21 — [VLT-01, VLT-02, ONB-08, SUG-IOS-009] `FileKeyValueStore` writes the vault blob+version pair atomically, gains file protection

- **What changed:** `KeyValueStore` gains `setMany(_:)` (default: loops over `set`, fine for `InMemoryKeyValueStore`); `FileKeyValueStore` overrides it to mutate every entry in the cache and persist once. `Vault.persist(_:)` now calls `kv.setMany([blobKey: blob, versionKey: version])` instead of two sequential `set` calls. `FileKeyValueStore`'s writes also add `.completeFileProtectionUnlessOpen` alongside the existing `.atomic`.
- **Why:** the blob and its version were two separate full-file writes; a crash between them left a stale version next to a fresh blob (harmless for decryption, but could trigger an avoidable VLT-02 409 loop). The file held only `.atomic` protection while the Keychain-backed wrap key already commits to `WhenUnlockedThisDeviceOnly` — the on-disk ciphertext file should carry comparable defense-in-depth.
- **Scoped down from the audit suggestion:** skipped the `lastPersistError`/`onPersistFailure` hook — SUG-IOS-005 already wired a constructor-injected `ErrorReporter` into `FileKeyValueStore.persist()` that reports write/encode failures, which supersedes that step; redoing it would have meant two competing observability paths.
- `.completeFileProtectionUnlessOpen`, not the stricter `.completeFileProtection` — a write already in flight shouldn't be invalidated by the device locking mid-write; revisit if SUG-IOS-002's background sync ever needs to write while locked.
- Verified: `xcrun swift test` 154/154; mutation-tested — reverting `Vault.persist` to two `set` calls fails the new spy-based test, and the file-protection resource-value assertion was checked against `/tmp` on the macOS host toolchain to confirm the option isn't iOS-only.

## 2026-08-21 — [FCH-04, VLT-03, SUG-IOS-007] Fiche history is pruned to 12 months on every write

- **What changed:** `Vault.recordAxisEdit` and `Vault.reconfirmFicheStaleness` now prune `contact.history` to the last 12 months (relative to the write's own timestamp) inside the same mutate-then-persist transaction, via a new private `prunedHistory(_:now:)` helper. Previously only `FicheViewModel.recentHistory` filtered at read time — storage retained every event forever.
- **Why:** FS-07 VLT-03 caps the vault blob at ≤1 MB server-side; unbounded history growth would eventually reject syncs, and (per SUG-IOS-005) that failure was silent. FCH-04's product surface is already scoped to 12 months, so pruning at write time loses nothing.
- Read-time filtering in `FicheViewModel.recentHistory` is unchanged — it stays the display source of truth for legacy blobs and clock-skew edge cases.
- Match-event (`.relationshipEvent`) retention is intentionally not special-cased — FS-05 doesn't exist yet and FCH-04 scopes the whole feed to 12 months; re-decide when match events land.
- New internal (non-public, `@testable`-only) `Vault.setTestHistory(id:history:)` test seam, since every production write path stamps `Date()` and tests need to seed back-dated events to exercise the prune.
- **Cross-platform follow-up:** Android stores history the same unbounded way (`apps/android/.../vault/Vault.kt`, SUG-AND-013) and needs the equivalent fix — not done here, out of this PR's `area:ios` scope.
- Verified: `xcrun swift test` 151/151, and mutation-tested: disabling `prunedHistory` fails `test_FCH04_historyOlderThanTwelveMonths_isPrunedOnNextWrite` and `test_VLT03_hundredEdits_historyStaysBounded`.
- **Gotcha:** `test_VLT03_hundredEdits_historyStaysBounded` seeds 50 back-dated events before its 100-edit loop on purpose. A bare loop of same-day edits asserts only that the loop ran — it passes with pruning disabled. The seeded stale events are what make `== 100` a statement about the prune.

## 2026-08-20 — [VLT-01, MAP-06, SUG-IOS-004] Undecryptable vault renders an honest state, not the calm empty map

- **What changed:** `Vault.hydrate()` now catches decrypt/decode failures and rethrows a new `VaultError.unreadable` (was previously left to bubble up as a raw `CryptoKit`/`DecodingError` that every call site's `try?`/`?? []` collapsed into "empty"). `CarteViewModel` gains `loadState: LoadState { .loading, .loaded, .unreadable }`; `CarteView` renders a new `Fr.carteUnreadable` message instead of MAP-06's calm empty-map copy when the vault couldn't be read.
- **Why:** a corrupted blob or a key/blob mismatch (e.g. an Application Support backup restored without its `ThisDeviceOnly` Keychain key) was indistinguishable from a genuinely empty vault — silent data loss, and VLT-05's "state the trade-off honestly" applies here too.
- **Scoped down from the audit suggestion:** the plan also asked to mirror the load-state distinction into `FicheViewModel`/onboarding view models. Skipped here — `FicheView` is only reachable from a contact already listed on Carte, so it's already gated by the same fix, and the acceptance criteria didn't require it. `ContactsViewModel.addManual`/`pick` failures still only report (no user-facing `showError`) — left as a fast-follow, not silently dropped.
- New `App/SwabApp.swift` UI-test hook `--uitesting-seed-corrupt-vault` seeds a non-ciphertext blob for the new XCUITest. `CarteLoadStateTests.swift` (new `SwabUITests` file, now that IOS-005 added the target) unit-tests the state machine directly.
- Verified: `xcrun swift test` 148/148, plus the full `scripts/e2e-ios.sh` gate on a booted simulator — 17/17 XCUITests pass (incl. the new `test_VLT05_corruptVault_showsHonestUnreadableState`) and the report is PASS with zero drift.
- **Gotcha:** no CI job runs the XCUITest suite — `ios-unit` runs `xcrun swift test` only, and no workflow invokes `scripts/e2e-ios.sh`. The E2E gate is local-only today, so the manifest's iOS `tests` arrays must list XCUITests exclusively; a unit-test name there fails the drift guard (caught exactly that way in review).

## 2026-08-20 — [IDT-02, IDT-04, SUG-IOS-012] `SecureStore` gains `delete`; `Session.clearTokens()`

- **What changed:** `SecureStore` protocol gets a third method, `delete(_:)`; `KeychainSecureStore` implements it via `SecItemDelete` (idempotent — `errSecItemNotFound` counts as success), `InMemorySecureStore` via `storage[key] = nil`. New `Session.clearTokens()` deletes both the access and refresh keys.
- **Why:** logout (IDT-02) and client-side account deletion (IDT-04) both need to remove tokens from the Keychain, and there was no way to do that without a raw `SecItemDelete`. Also fixes the Keychain test's cleanup, which was writing an empty string instead of removing its probe item.
- **Not wired into any production flow yet** — this is enabling plumbing; a logout UI is future FS-07 work.
- **`VaultKeyStore` deliberately does not get a delete method** — destroying the vault key is the VLT-05 data-loss event and needs its own reviewed change.
- Verified: `xcrun swift test` 142/142 (new: `test_delete_removesItem_andIsIdempotent`, `test_IDT02_clearTokens_removesAccessAndRefresh`).

## 2026-08-20 — [G3, SUG-IOS-005] Error-boundary reporter — every `try?` vault swallow now reports

- **What changed:** new `Sources/SwabCore/Observability/ErrorReporter.swift` (`ErrorReporter` protocol, `ReportedError`, `OSLogErrorReporter`, `NoopErrorReporter`). `CarteViewModel`, `FicheViewModel`, `ContactsViewModel`, `CalibrateViewModel`, `DoneViewModel`, and `FileKeyValueStore.persist()` take a `reporter: ErrorReporter = NoopErrorReporter()` and now `do/catch { reporter.report(...) }` instead of discarding failures with `try?`. `SwabApp.swift`'s composition root wires one real `OSLogErrorReporter()` into all of them. User-facing fallback behavior on failure is unchanged (empty list / unchanged contact, matching the prior `try?`/`?? []` outcomes).
- **Why:** G3 requires "Mobile/web report errors via a single error-boundary reporter"; every failure (dropped vault write, sync conflict, disk persist) was previously unobservable both on-device and to a developer.
- **Privacy is the point of the PR, not an afterthought:** `ReportedError.errorDescription` is always a fixed short code (`VaultError.reportCode(for:)` / `VaultSyncError.reportCode(for:)` — `"blobUnavailable"`, `"invalidRing"`, `"unreadable"`, `"conflictPersisted"`, `"syncFailed"`), never `Error.localizedDescription`, since `DecodingError.dataCorrupted`'s context string can embed decoded blob fragments.
- `DoneViewModel.finish()` also wraps `VaultSync.sync()` in an `OSSignposter` interval (duration only, no payload) — the closest vendor-neutral G3 metric available without adding OTel to a Swift package that has zero third-party deps.
- New `Tests/SwabUITests/ErrorReporterPrivacyTests.swift` (not `SwabCoreTests` as the audit suggestion assumed — reporting happens at the SwabUI view-model boundary, which `SwabCoreTests` can't import): forces a real corrupt-blob decrypt failure and a persisted `VaultSync` conflict, asserts no `ReportedError` field ever contains ring/état/ressenti/rôle vocabulary or the seeded display name.
- Verified: `xcrun swift test` 142/142.

## 2026-08-16 — [FCH-09, SUG-IOS-011] Stored classification values are identifiers, not French copy

- **What changed:** new `ClassificationValues.swift` with `Etat` / `Ressenti` / `RoleContexte` (identifiers per FS-03 § *Stored value vocabulary*). The vault now persists `busy`, not `occupé`; `EtatColors` is keyed by `Etat` instead of by `Fr.t(...)`; `FicheFilterConsequence` compares `.paused`; `Vault`'s setters take the typed value, so writing display copy into the vault is a compile error.
- **Why:** ADR-001 stage 0b. Rewording a label — or shipping the planned Arabic locale — silently orphaned every stored value: the contact kept its data but rendered as unset through `color(for:)`'s fallback. After stage 2 these are database columns and the same rewording becomes a data migration.
- **Nothing user-visible changes.** Chips still render French labels; the views map label → value at the boundary, the way the Intimité ring already did. The XCUITest suite needed one edit (`etats[2]` → `etatLabels[2]`) and no new assertions.
- **Dual-read is permanent.** `legacyFrenchTokens` is a **frozen literal, never derived from `Fr`** — deriving it would re-create the exact coupling being removed. Unknown tokens (`douceur`, `confidente`, still present in `vault-test-vectors.json`) round-trip verbatim and render unset; a read never drops data.
- **History events deliberately still store the display label.** FCH-04 hands event creation to the server at ADR-001 stage 2, which will model it properly; re-encoding it now would be thrown away. `test_FCH01_setFicheRoles_persistsAndAppendsHistory` pins both halves at once.
- **Gotcha for the Android mirror:** Swift `String ==` uses canonical equivalence, so `"occupé"` matches whether it was stored NFC or NFD. **Kotlin compares UTF-16 code units and will not** — the port must normalise to NFC before the legacy lookup, or accented tokens silently fail to migrate.
- Verified: `xcrun swift test` 140/140 · `scripts/e2e-ios.sh` **PASS**, 16/16 executed, zero drift-guard failures.
