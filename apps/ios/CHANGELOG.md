# apps/ios — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

> Entries before 2026-08-15 are archived in [../../docs/archive/ios-CHANGELOG-pre-2026-08-15.md](../../docs/archive/ios-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.


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
