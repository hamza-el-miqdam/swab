# SUG-IOS-017 — Dead code: `route(for:)` is an RN-era path table used only by its own test

- **Area:** ios
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** ONB-08

## Problem / Opportunity

`public func route(for step: OnboardingStep) -> String` (`apps/ios/Sources/SwabCore/Onboarding/OnboardingState.swift:50-59`) returns Expo-Router-style path strings (`"/onboarding/welcome"`, `"/"` …). Grep across `Sources/`, `App/`, and `SwabAppUITests/` shows its only callers are its own assertions in `Tests/SwabCoreTests/OnboardingStateTests.swift:57-62`. The iOS app navigates by switching on `OnboardingStep` directly in `RootView.content` (`App/SwabApp.swift:149-198`) — no string routes exist anywhere in the SwiftUI layer.

Dead public API in `SwabCore` has real cost: it pads the module's public surface, its test lines count toward the coverage numbers quoted in the changelog while verifying nothing the app uses, and a future contributor may wire navigation to it believing it is load-bearing.

## Implementation plan

1. Delete `route(for:)` from `OnboardingState.swift:50-59`.
2. Delete the corresponding test block in `OnboardingStateTests.swift:57-62` (keep the rest of that file — step persistence/resume tests are the real ONB-08 coverage).
3. Sweep for any residual mention: `grep -rn "route(for" apps/ios` must return nothing.
4. Changelog entry (G5): note it was an RN-reference port artifact (`src/onboarding/state.ts` mirrored routes) that native navigation never adopted, so future readers know removal was deliberate, not lost functionality.

## Tests & acceptance criteria

- `cd apps/ios && xcrun swift test` — full suite green minus the deleted assertions; no other test references the symbol.
- `scripts/e2e-ios.sh` unaffected (navigation is step-switch based).

## Risks & gotchas

- Verify Android/RN docs don't cite the iOS function (they don't — the handoff describes the step machine, not this helper; `docs/migration/rn-native-handoff.md:112-118` covers steps and storage key only).
- If there is any appetite for deep-linking later, that would be designed against `NavigationStack` paths, not these strings — don't keep it "just in case" (it would be the wrong shape anyway).
