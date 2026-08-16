# SUG-IOS-010 — Dynamic Type breaks fiche chip rows; phone/OTP fields miss iOS input traits (autofill, content types)

- **Area:** ios
- **Topic:** accessibility
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** FCH-01, ONB-02, MAP-03

## Problem / Opportunity

The handoff makes accessibility binding: "every touchable has a role + label; dynamic type respected" (`docs/migration/rn-native-handoff.md:147-149`). Labels are done well, but Dynamic Type and input traits have gaps:

1. **Fixed-width HStacks on the fiche:** the Intimité row lays out all four ring chips in a plain `HStack` (`apps/ios/Sources/SwabUI/Fiche/FicheView.swift:87-98`), and État/Ressenti rows do the same (`:109-127`). At accessibility text sizes, four chips like « Très proche » cannot fit one row — SwiftUI compresses/truncates them. Only Rôles uses a wrapping `LazyVGrid` (`FlowRolesView`, `:253-280`).
2. **Fixed font size on map nodes:** `ContactNodeView` uses `.font(.system(size: 13, weight: .semibold))` (`apps/ios/Sources/SwabUI/Carte/RadialMapView.swift:149`), which does not scale with Dynamic Type (initials-only content mitigates but doesn't excuse; use a relative metric).
3. **Missing text input traits:** the phone field has `.keyboardType(.phonePad)` but no `.textContentType(.telephoneNumber)` (`apps/ios/Sources/SwabUI/Onboarding/PhoneView.swift:22-26`); the OTP field has `.keyboardType(.numberPad)` but no `.textContentType(.oneTimeCode)` (`apps/ios/Sources/SwabUI/Onboarding/OtpView.swift:39-43`) — so when real SMS OTP arrives (OQ-IDT-1), iOS's SMS autofill will not offer the code, which is both a UX and an accessibility loss.
4. **Error texts appear without announcement:** `phoneError`/`otpError` `Text`s (`PhoneView.swift:28-30`, `OtpView.swift:50-52`) render silently; VoiceOver users get no notification that the request failed.

## Implementation plan

1. Reuse the existing wrap pattern: generalize `FlowRolesView` into a private `WrappingChipRow(items:isSelected:onTap:)` in `FicheView.swift` (it is already generic over a string list — `LazyVGrid(columns: [GridItem(.adaptive(minimum: 90))])`), and use it for the Intimité, État, and Ressenti sections in `axes` (`FicheView.swift:85-129`), replacing the three `HStack`s. Keep per-chip `accessibilityLabel` + `.isSelected` trait exactly as `axisChip` does today (`:141-157`).
2. Map node font: replace the fixed size with `.font(.footnote.weight(.semibold))` or `@ScaledMetric(relativeTo: .footnote) var nodeFontSize = 13` and `.font(.system(size: nodeFontSize, weight: .semibold))` (`RadialMapView.swift:148-150`). Node circle sizes come from `MapGeometry.nodeSize` — leave geometry alone (visual grammar is spec'd, MAP-03); scaling text within the fixed node is the honest first step, with `.minimumScaleFactor(0.7)` to avoid overflow.
3. Input traits: add `.textContentType(.telephoneNumber)` to the phone field and `.textContentType(.oneTimeCode)` to the OTP field (inside the existing `#if os(iOS)` blocks).
4. Error announcement: add `.accessibilityAddTraits(.updatesFrequently)` is not right — instead post `AccessibilityNotification.Announcement(Fr.t(.phoneError))` when `showError` flips true (`.onChange(of: viewModel.showError)`), or wrap the error `Text` in `.accessibilityLabel` + make the containing VStack `.accessibilityElement(children: .contain)`; the announcement approach is the one that actually notifies VoiceOver.
5. Same wrap treatment for `CalibrateView`'s état/ressenti/ring button rows (`apps/ios/Sources/SwabUI/Onboarding/CalibrateView.swift:143-152, 166-182`), which use plain `HStack`s too.

## Tests & acceptance criteria

- XCUITest addition `MapAndFicheE2ETests.test_FCH01_axisChips_remainHittableAtAccessibilityTextSize`: relaunch with `app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityL"]` before `launch()`, run the fiche flow, assert `app.buttons[Fr.t(.ring4)].isHittable` and `app.buttons[FicheVocabulary.etats[2]].isHittable` (the last chip of each row is the one that truncates today).
- Existing E2E suite (`scripts/e2e-ios.sh`) stays green — chip labels unchanged, only layout wraps.
- Manual check note for the PR: screenshot fiche at AX5 size before/after.

## Risks & gotchas

- Do not change chip label copy or accessibility labels — `OnboardingFlow`/`MapAndFicheE2ETests` look elements up by exact French copy.
- `GridItem(.adaptive(minimum: 90))` may still truncate very long labels at AX sizes; add `.fixedSize(horizontal: false, vertical: true)` on chip text rather than shrinking font below readable sizes.
- `.textContentType(.oneTimeCode)` changes the keyboard's suggestion bar; the E2E `typeText` path is unaffected, but verify the OTP field still accepts programmatic typing on the Simulator.
