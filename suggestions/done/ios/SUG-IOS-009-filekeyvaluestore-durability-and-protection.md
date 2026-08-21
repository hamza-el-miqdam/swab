# SUG-IOS-009 — FileKeyValueStore: silent write failures, no data protection class, blob+version written non-atomically

- **Area:** ios
- **Topic:** security
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-01, VLT-02, ONB-08

## Problem / Opportunity

`FileKeyValueStore` (`apps/ios/Sources/SwabCore/Storage/KeyValueStore.swift:30-58`) is the production store for the encrypted vault blob, its version, and the onboarding step (`App/SwabApp.swift:111,132-136`). Three hardening gaps:

1. **Silent write failure:** `persist()` is `guard let data = try? ... else { return }` + `try? data.write(...)` (`KeyValueStore.swift:54-57`). If the write fails (disk full, protection state), the in-memory cache says the write succeeded; on next launch the vault silently reverts to an older state — read-your-writes is violated across restarts with no signal (compare: `Vault.persist` happily continues, `Sources/SwabCore/Vault/Vault.swift:167-168`).
2. **No file protection:** the file is written with only `.atomic` (`KeyValueStore.swift:56`). Contents are ciphertext + a step name, so this is defense-in-depth rather than a leak, but the Keychain side already commits to `WhenUnlockedThisDeviceOnly` (`Sources/SwabCore/Identity/SecureStore.swift:89`); the file should carry `.completeFileProtectionUnlessOpen` (or `.completeFileProtection` if background sync from SUG-IOS-002 doesn't need writes while locked — pick to match the sync design).
3. **Blob/version pair is two separate writes:** `Vault.persist` does `kv.set(blobKey)` then `kv.set(versionKey)` (`Vault.swift:167-168`), i.e. two full-file rewrites; a crash between them leaves version N-1 next to blob N. Harmless for decryption but can confuse VLT-02 conflict handling (a stale version invites an avoidable 409 loop iteration).

## Implementation plan

1. Change the `KeyValueStore` protocol minimally: keep `get`/`set` non-throwing for compatibility, but add `func setMany(_ entries: [String: String]) async` to the protocol with a default implementation (loop over `set`) and a real atomic implementation in `FileKeyValueStore` (mutate cache for all entries, persist once). Switch `Vault.persist` to `await kv.setMany([Self.blobKey: blob, Self.versionKey: String(version)])`.
2. Make persistence failure observable without breaking the protocol: give `FileKeyValueStore` a `public private(set) var lastPersistError: Error?` and an optional `onPersistFailure: (@Sendable (Error) -> Void)?` hook the composition root wires to the error reporter (SUG-IOS-005). Replace `try?` with `do/catch` in `persist()`.
3. Add write options: `try data.write(to: url, options: [.atomic, .completeFileProtectionUnlessOpen])`. Also set `URLResourceValues.isExcludedFromBackup = false` deliberately (documented decision: backing up ciphertext is fine and matches VLT-05's device-loss story — the key is `ThisDeviceOnly`, so a restored backup on a new device is unreadable, which is the honest POC behavior; record this in the changelog entry).
4. Keep `InMemoryKeyValueStore` conforming via the default `setMany`.

## Tests & acceptance criteria

- Additions to `Tests/SwabCoreTests/KeyValueStoreTests.swift`:
  - `test_VLT02_setMany_persistsAllOrNothingAcrossReopen` — `setMany` two keys, re-instantiate `FileKeyValueStore(url:)`, both present.
  - `test_persistFailure_isSurfaced` — point the store at an unwritable URL (e.g. a path inside a nonexistent read-only dir), `set`, assert `lastPersistError != nil` / hook fired.
  - `test_VLT01_vaultPersist_writesBlobAndVersionInOneFileWrite` — spy store counting `setMany` vs `set` calls; `Vault.persist` must use the batched path (assert one `setMany` containing both keys).
- Run: `cd apps/ios && xcrun swift test`; `scripts/e2e-ios.sh` green (file protection has no effect on an unlocked Simulator).

## Risks & gotchas

- `.completeFileProtection` (strict) would break any future background sync writes while locked — coordinate the choice with SUG-IOS-002's background trigger before picking the strictest class.
- Protocol additions ripple to every conformer; the default-implementation approach keeps `InMemoryKeyValueStore` and test doubles compiling.
- Do not make `set` throwing — that churns every call site (`OnboardingStateStore`, `Vault`, UITest hooks) for little gain; the reporter hook covers observability.

---

## Resolution (2026-08-21) — implemented, with one step dropped as superseded

Landed in PR #111. Two deviations from the plan above:

**1. Step 2 (`lastPersistError` / `onPersistFailure`) was not built — deliberately.** SUG-IOS-005 (PR #103) had already given `FileKeyValueStore` a constructor-injected `ErrorReporter` and replaced the `try?` in `persist()` with `do/catch` reporting `writeFailed` / `encodeFailed`. Adding the hook on top would have meant two competing observability paths for the same failure. The step's intent — a dropped write must not be silent — is satisfied; the mechanism differs.

**2. Step 3's file-protection assertion cannot be tested the way the plan implies.** `SwabCoreTests` runs on the *macOS host* (`xcrun swift test`, no Simulator target), and macOS honours data-protection classes inconsistently: macOS 26 reports `completeUnlessOpen` for the write, while the macOS-15 CI runner reports the volume default `completeUntilFirstUserAuthentication` for the identical write. A plain `XCTAssertEqual(values.fileProtection, .completeUnlessOpen)` therefore passes locally and fails in CI. What shipped: `FileKeyValueStore.writeOptions` is a public constant `persist()` passes verbatim, and the portable test asserts *that*; a second test still checks the real on-disk class, but only after a control write with no protection option proves the host implements classes at all — otherwise it skips rather than passing vacuously. **Do not "simplify" it back to a bare resource-value assertion.**

`isExcludedFromBackup` was left at its default (`false`) per the plan, and the reasoning is recorded in the changelog entry.
