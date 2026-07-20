# SUG-IOS-008 — Base URL and phone-hash salt are hardcoded; dev-OTP UI is not DEBUG-gated: no path to a real device/TestFlight build

- **Area:** ios
- **Topic:** dx
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** IDT-01, IDT-06, ONB-02

## Problem / Opportunity

Three production-readiness constants are compiled in with no configuration seam:

1. **API base URL:** `URL(string: "http://127.0.0.1:3001")!` in the composition root (`apps/ios/App/SwabApp.swift:124`). On any physical device this points at the phone itself; there is no scheme/xcconfig/Info.plist override. The RN reference used `EXPO_PUBLIC_API_URL` (handoff `docs/migration/rn-native-handoff.md:74`), and G1 requires env-sourced config validated at boot.
2. **Phone-hash salt:** `PhoneHash.defaultSalt = "swab-poc-phone-salt-v1"` (`apps/ios/Sources/SwabCore/Identity/PhoneHash.swift:8`) with no per-deployment override anywhere — handoff §2.2 (`rn-native-handoff.md:64-68`) says the salt is per-deployment and all clients must share it or contact discovery (IDT-06) breaks. `PhoneViewModel.requestCode` always uses the default (`Sources/SwabUI/Onboarding/OnboardingViewModels.swift:50`).
3. **Dev-OTP display:** `Text("Code (dev) : \(devCode)")` (`apps/ios/Sources/SwabUI/Onboarding/OtpView.swift:35-37`) renders in ALL build configurations whenever the server returns `devCode`, and the string bypasses `Fr.swift` (the only hardcoded user-facing copy in the app). A release build pointed at a misconfigured non-prod API would show it.

## Implementation plan

1. Add `Sources/SwabCore/AppConfig.swift`:
   ```swift
   public struct AppConfig: Sendable {
       public let apiBaseURL: URL
       public let phoneHashSalt: String
       public static func load(bundle: Bundle = .main) throws -> AppConfig { ... }
   }
   ```
   `load` reads `SwabApiBaseURL` and `SwabPhoneHashSalt` from Info.plist (fed by build settings: add `INFOPLIST_KEY_...`-style entries or `SWAB_API_BASE_URL`/`SWAB_PHONE_HASH_SALT` build settings with `$(...)` substitution in the generated Info.plist via `INFOPLIST_PREPROCESS` — simplest under `GENERATE_INFOPLIST_FILE`: `INFOPLIST_KEY` doesn't cover custom keys, so use `INFOPLIST_FILE` additions or `xcconfig` + `Bundle.object(forInfoDictionaryKey:)`). Fail fast (throw) on missing/invalid URL — G1's "typed env, fail at boot" applied to iOS. Default values in the Debug configuration keep `127.0.0.1:3001` / `swab-poc-phone-salt-v1` so the E2E suite is unaffected.
2. In `App/SwabApp.swift` `RootView.init` (`:106-130`), build `AppConfig` once; pass `config.apiBaseURL` to `ApiClient`, and pass the salt down to the two hash call sites: `PhoneViewModel` (`OnboardingViewModels.swift:50`) and `ContactsViewModel.pick` (`:164`) — add a `salt` init parameter defaulting to `PhoneHash.defaultSalt` so tests don't churn.
3. Wrap the dev-code UI in a compile-time gate: `#if DEBUG` around `OtpView.swift:35-37` — SwabUI is a package target, so confirm the app's Debug config propagates `DEBUG` to package builds (SPM defines `DEBUG` for debug builds by default). The XCUITest suite runs Debug, so `OnboardingFlow` is unaffected (it fetches the code from the API directly anyway, `SwabAppUITests/Support/DevBackend.swift:51-64`).
4. Note ATS in the PR: loopback HTTP is exempt, but a real deployment URL must be HTTPS — validate scheme == https when host is non-loopback inside `AppConfig.load`.

## Tests & acceptance criteria

- `Tests/SwabCoreTests/AppConfigTests.swift`:
  - `test_G1_missingBaseURL_throwsAtLoad`
  - `test_G1_nonLoopbackHttpURL_isRejected`
  - `test_IDT06_saltOverride_changesHashDeterministically` — `PhoneHash.hash(n, salt: "other")` differs from default and matches a precomputed vector.
- Existing `test_IDT06_phoneHashVectorsMatchExactly` (`Tests/SwabCoreTests/VaultCryptoTests.swift:105-116`) must stay green (default salt unchanged).
- Run: `cd apps/ios && xcrun swift test`, then `scripts/e2e-ios.sh` (Debug defaults keep it green).

## Risks & gotchas

- Changing the salt after launch orphans every stored `phoneHash` — the config seam must make the salt *deployment-scoped*, not user-editable, and the default must never drift.
- `pbxproj` edits are hand-authored in this repo (see `apps/ios/CHANGELOG.md` app-shell entry gotchas); keep the change to build settings minimal and mirror it across all six configurations like the code-signing fix did.
- Don't read `ProcessInfo.environment` at runtime for config — device builds don't get env vars; Info.plist/build settings are the iOS-native equivalent.
