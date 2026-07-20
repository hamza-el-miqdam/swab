# SUG-IOS-004 — An undecryptable/corrupted vault renders as an empty map: silent data loss with no user-visible state

- **Area:** ios
- **Topic:** correctness
- **Impact:** high
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-01, VLT-05, MAP-06

## Problem / Opportunity

`Vault.hydrate()` throws when the blob exists but cannot be decrypted or decoded (`apps/ios/Sources/SwabCore/Vault/Vault.swift:154-156`: `VaultCrypto.decrypt` throws on bad key/tamper, `JSONDecoder().decode` throws on corrupt JSON). Every UI call site collapses that failure into "empty":

- `CarteViewModel.refresh()`: `contacts = (try? await vault.getContacts()) ?? []` (`apps/ios/Sources/SwabUI/Carte/CarteViewModel.swift:37`)
- `CalibrateViewModel.refresh()` / `ContactsViewModel.refresh()`: same pattern (`apps/ios/Sources/SwabUI/Onboarding/OnboardingViewModels.swift:148-150, 209-211`)
- `FicheViewModel.refresh()`: `if let latest = try? await vault.getContact(...)` (`apps/ios/Sources/SwabUI/Fiche/FicheViewModel.swift:51-55`)

A user whose Keychain key survived but whose blob was corrupted (or vice versa: a restored backup file with a fresh key — plausible given the file store lives in Application Support, which is backed up, while the key is `ThisDeviceOnly`, `SecureStore.swift:38-39,89`) sees the calm MAP-06 empty state « Ta carte est calme… » — indistinguishable from genuinely having no contacts. VLT-05 requires this trade-off to be "stated honestly in-app"; silently showing an empty map is the opposite. Worse, if the user then re-onboards/adds a contact, nothing can succeed either (`addContact` also hydrates and throws), so buttons just silently do nothing (`try? await vault.addContact`, `OnboardingViewModels.swift:165,171`).

## Implementation plan

1. Make the failure typed: in `Vault.swift`, extend `VaultError` with `case unreadable` (keep `blobUnavailable`). In `hydrate()`, wrap the decrypt+decode in `do/catch` and rethrow as `VaultError.unreadable` so callers can distinguish "no data" from "data present but lost".
2. Add a load-state to `CarteViewModel`: replace the bare array with
   `public enum LoadState: Equatable { case loading, loaded, unreadable }` + `public private(set) var loadState: LoadState`. In `refresh()`, `do { contacts = try await vault.getContacts(); loadState = .loaded } catch { loadState = .unreadable }` — no networking types introduced (keeps `CarteOfflineInvariantTests` green).
3. In `CarteView.swift` (`mapArea`, `apps/ios/Sources/SwabUI/Carte/CarteView.swift:80-96`): when `loadState == .unreadable`, render a calm, honest French message instead of the empty-state copy. Copy must go through `Fr.swift` as a new key (e.g. `carteUnreadable`) — original copy is allowed with the same "approved addition" status as `carte.empty` (`Sources/SwabCore/L10n/Fr.swift:67`), soft tone, no alarm, no digits (CopyEthosTests scans all keys). Suggest wording to the spec-specialist rather than inventing final copy silently.
4. Mirror the same distinction in `FicheViewModel.refresh()` and the onboarding view models: at minimum, stop `addManual`/`pick` from silently no-oping — surface a `showError`-style flag like `PhoneViewModel` already does (`OnboardingViewModels.swift:29,56`).
5. Report the error through the single reporter seam (see SUG-IOS-005) — count/type only, never vault contents (G3 "never log vault contents").

## Tests & acceptance criteria

- `Tests/SwabCoreTests/VaultTests.swift` additions:
  - `test_VLT01_corruptBlob_throwsUnreadableNotEmpty` — seed `InMemoryKeyValueStore` with `vault.blob.v1 = "not-base64"` and assert `getContacts()` throws `VaultError.unreadable`.
  - `test_VLT01_blobEncryptedUnderDifferentKey_throwsUnreadable` — encrypt a valid `VaultData` under key A, hydrate with a store whose key is B.
- New `Tests/SwabCoreTests/CarteLoadStateTests.swift` is not possible (CarteViewModel is in SwabUI, untested — see SUG-IOS-006); until a SwabUI test target exists, assert the state machine at the vault level and cover the UI path in the E2E suite:
  - New XCUITest `RegressionAndResilienceE2ETests.test_VLT05_corruptVault_showsHonestUnreadableState` using a new DEBUG launch argument `--uitesting-seed-corrupt-vault` in `UITestHooks` (`App/SwabApp.swift:20-75`, same pattern as `seedLegacyVaultArgument`) that writes a garbage blob + `onboarding.step.v1 = complete`, then asserts the new copy appears and the calm-empty copy does NOT.
- Run: `cd apps/ios && xcrun swift test` and `scripts/e2e-ios.sh` (update `docs/qa/e2e-scenarios.md` + `e2e-coverage.json` in the same PR per G2).

## Risks & gotchas

- Never auto-wipe the blob on decrypt failure — the corruption may be transient (partial file write); leave recovery/reset UX as an explicit product decision, just make the state visible.
- The new `Fr` key must not contain digits/percent/gamification vocabulary or `CopyEthosTests` (`Tests/SwabCoreTests/CopyEthosTests.swift:16-45`) fails.
- Keep `VaultError.unreadable` out of the sync path's happy flow: `getEncryptedVault()` will now throw it too, which is correct (never push a blob you cannot read as authoritative state... actually it pushes ciphertext as-is; decide deliberately: pushing an unreadable blob preserves server-side history, so let `getEncryptedVault()` keep working off the raw kv value — do not change its behavior without a test).
