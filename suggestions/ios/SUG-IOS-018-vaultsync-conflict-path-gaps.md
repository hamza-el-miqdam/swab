# SUG-IOS-018 — VaultSync 409 path: pulled server blob is discarded unread, and the retry can push a stale local blob

- **Area:** ios
- **Topic:** offline
- **Impact:** low
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-02, FCH-01

## Problem / Opportunity

Two gaps in `VaultSync.sync()` (`apps/ios/Sources/SwabCore/Vault/VaultSync.swift:24-39`), both within the letter of the single-device POC but worth tightening/formalizing:

1. **Server blob fetched, never used:** on 409 the code calls `api.getVault()` and reads only `server?.version` (`VaultSync.swift:31-33`); the server's blob — which in any multi-writer situation contains data the local device does not have — is dropped and overwritten. FS-07 VLT-02's own wording is "client re-pulls, **merges locally**, retries" (`docs/specs/FS-07-identity-vault.md:33`); the accepted POC simplification is last-write-wins, but nothing records that the client-side merge is a stub. The risk becomes real the moment IDT-05 (second device / reinstall with recovery) exists: first sync from a fresh install pushes an empty-ish vault over the server copy.
2. **Stale-blob retry race:** the blob is captured once at `:25` (`vault.getEncryptedVault()`), but the retry at `:33` pushes that same captured blob with a bumped version. If the user edits between the first push and the retry (both are `await` points), the retry persists the *older* blob under the *newer* version; the newer local edit only reaches the server on the next sync (which today never happens — see SUG-IOS-002). Re-reading from the vault before the retry closes the window at near-zero cost.

Additionally, `getVault()` on a fresh install is never called outside the 409 path at all — a reinstalling user with an intact Keychain key (possible: Keychain survives app deletion; the file store does not) never pulls their server vault back. That restore flow is IDT-05/VLT-05 product territory; flag it in the issue rather than building it here.

## Implementation plan

1. Close the stale-blob window: in the `.conflict` branch, re-read `let (freshBlob, _) = try await vault.getEncryptedVault()` immediately before the retry push, and push `freshBlob` (keep the version arithmetic `(server?.version ?? version) + 1` exactly as-is — it is contract-tested).
2. Make the non-merge explicit and safe(ish): when `server` is non-nil, compare `server!.blob == blob`; if they differ, report a `"vault.sync.overwrote-server"` event through the SUG-IOS-005 reporter (counts only, no contents) so an eventual multi-device bug is diagnosable instead of silent. Add a `// VLT-02 POC: last-write-wins; local merge is deliberately not implemented — see FS-07 + issue #<n>` comment.
3. Open the follow-up issue for real merge + fresh-install pull (IDT-05 scope), referencing the FS-07 acceptance criterion "no 409 loop occurs".

## Tests & acceptance criteria

- Additions to `Tests/SwabCoreTests/VaultSyncTests.swift` (extend `FakeVaultSyncApi`, `:8-42`):
  - `test_VLT02_retryAfterConflict_pushesCurrentBlobNotStaleCapture` — make the fake's first `pushVault` mutate the vault (add a contact via the shared `Vault` reference) before returning `.conflict`; assert `pushCalls[1].blob != pushCalls[0].blob` and that the second blob decrypts (with the test key) to the 2-contact state.
  - `test_VLT02_conflictOverwrite_isObservable` — server returns a different blob; the recording reporter sees exactly one overwrite event; wire body still only `{blob, version}` (reuse the `FichePrivacyInvariantTests` capture approach if reporter wiring passes near the transport).
- Existing four `VaultSyncTests` must pass unchanged — the version arithmetic and one-retry contract are locked there (`VaultSyncTests.swift:62-104`).
- Run: `cd apps/ios && xcrun swift test`.

## Risks & gotchas

- Do NOT attempt blob merging in this change — merging requires decrypting and reconciling `VaultData`, which drags vault semantics into `VaultSync`; that design belongs to the IDT-05 issue and likely a `Vault.merge(remote:)` actor method instead.
- The reporter event must never include blob contents or even blob lengths delta framing that could invite size analysis habits server-side — event name + count only.
- Keep `VaultSync` free of UI/network additions beyond `VaultSyncApi` — `FichePrivacyInvariantTests` drives the real path and will catch wire-shape drift.
