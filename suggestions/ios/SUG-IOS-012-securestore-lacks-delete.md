# SUG-IOS-012 — SecureStore has no delete: logout/account-deletion cannot be built cleanly, and test cleanup writes empty strings instead

- **Area:** ios
- **Topic:** security
- **Impact:** low
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** IDT-02, IDT-04

## Problem / Opportunity

The `SecureStore` protocol exposes only `get`/`set` (`apps/ios/Sources/SwabCore/Identity/SecureStore.swift:10-13`). Observable consequences today:

- `KeychainSecureStoreTests` "cleans up" by writing an empty string: `defer { try? store.set(testKey, value: "") }` (`Tests/SwabCoreTests/KeychainSecureStoreTests.swift:26`) — the probe item lives in the host keychain forever.
- The DEBUG UI-test reset bypasses the abstraction entirely with a raw `SecItemDelete` and a duplicated service-name constant (`App/SwabApp.swift:31,42-46`), which will silently drift if the service ever changes.
- There is no way to implement logout (revoke session per IDT-02) or the client side of account deletion (IDT-04, currently deferred) without deleting `swab.session.*` and `swab.vault.key.v1` items; `Session` has no `clear` (`Sources/SwabCore/Identity/Session.swift:14-32`).

## Implementation plan

1. Add `func delete(_ key: String) throws` to the `SecureStore` protocol (`SecureStore.swift:10-13`).
2. `KeychainSecureStore`: implement via `SecItemDelete(baseQuery(for: key) as CFDictionary)`; treat `errSecItemNotFound` as success (idempotent delete), throw `SecureStoreError.keychain(status)` otherwise.
3. `InMemorySecureStore`: `storage[key] = nil` under the existing lock.
4. `Session`: add `public func clearTokens() throws` deleting both `Self.accessKey` and `Self.refreshKey`.
5. `VaultKeyStore`: deliberately do NOT add a key-delete helper in this PR — destroying the vault key is the VLT-05 data-loss event and deserves its own reviewed change; note this in the doc comment.
6. Update `UITestHooks.apply` (`App/SwabApp.swift:37-47`) to keep the broad service-wide `SecItemDelete` (it wipes *all* items including future ones, which is what a fresh-install reset wants) but add a comment cross-referencing the new protocol method; no behavior change needed there.
7. Fix the test cleanup at `KeychainSecureStoreTests.swift:26` to `defer { try? store.delete(testKey) }`.

## Tests & acceptance criteria

- Additions to `Tests/SwabCoreTests/KeychainSecureStoreTests.swift` (with the existing `XCTSkip`-when-unavailable guard, `:14-16`):
  - `test_delete_removesItem_andIsIdempotent` — set → delete → `get` returns nil → delete again does not throw.
- Additions to `Tests/SwabCoreTests/SessionTests.swift`:
  - `test_IDT02_clearTokens_removesAccessAndRefresh` — save, clear, both getters nil and the in-memory store no longer contains `swab.session.refresh.v1`.
- Run: `cd apps/ios && xcrun swift test`.

## Risks & gotchas

- Every `SecureStore` conformer (including any test double added by other suggestions) must implement `delete`; a protocol extension default is NOT appropriate here — silent no-op deletes on a secure store would be a security bug, so let the compiler force each implementation.
- Nothing should call `clearTokens` yet in production flows — this is enabling plumbing; wiring it into a logout UI is future FS-07 work.
