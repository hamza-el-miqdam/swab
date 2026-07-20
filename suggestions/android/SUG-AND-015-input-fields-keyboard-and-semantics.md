# SUG-AND-015 — Phone/OTP inputs use the default text keyboard, no autofill, and placeholder-as-contentDescription semantics

- **Area:** android
- **Topic:** accessibility
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-02, ONB-03

## Problem / Opportunity

The shared `InputField` (/Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/ui/onboarding/Primitives.kt:66-73) is used for the phone number (PhoneScreen.kt:22), the 6-digit OTP (OtpScreen.kt:37), the display name (OtpScreen.kt:39), and manual contact names (ContactsScreen.kt:32) — with no `KeyboardOptions` parameter at all (grep over `src/main` finds zero `KeyboardOptions`/`KeyboardType` usages):

1. **Wrong keyboards.** Phone entry gets the full QWERTY keyboard instead of `KeyboardType.Phone`; OTP gets it instead of `KeyboardType.NumberPassword`/`Number`. On-device this is the single most felt onboarding friction and invites malformed input (`PhoneHash.normalizePhone` strips non-digits, PhoneHash.kt:15-20, but the UX is still wrong).
2. **No SMS OTP autofill.** Android offers one-tap SMS code fill via autofill hints (`ContentType.SmsOtpCode` semantics in Compose); the OTP field doesn't opt in, so users retype the code manually. (POC currently shows a devCode on screen, OtpScreen.kt:36, but ONB-02 is designed for real SMS per FS-07 IDT-01.)
3. **Semantics misuse.** `InputField` sets `contentDescription = placeholder` on a text field (Primitives.kt:71). For TalkBack, a text field should get its name from a `label`/`placeholder` slot; overriding `contentDescription` masks the field's edited content announcements on some TalkBack versions. Same pattern on `PrimaryButton`/`GhostButton` (Primitives.kt:52-63), where `contentDescription = label` is redundant — the inner `Text` already provides it — and forces the E2E suite to match on contentDescription instead of text in some places (E2EFlows.kt:173, 223-225, 242-246). Buttons: harmless but noisy; fields: worth fixing.

## Implementation plan

1. Extend `InputField` (Primitives.kt:66-73) with an optional `keyboardOptions` parameter, defaulting to text:
   ```kotlin
   @Composable
   fun InputField(
       value: String,
       placeholder: String,
       onValueChange: (String) -> Unit,
       keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
       contentType: ContentType? = null,
   ) {
       OutlinedTextField(
           value = value,
           onValueChange = onValueChange,
           placeholder = { Text(placeholder) },
           keyboardOptions = keyboardOptions,
           modifier = Modifier.semantics {
               contentDescription = placeholder // keep: E2E selectors depend on it (see gotchas)
               if (contentType != null) this.contentType = contentType
           },
       )
   }
   ```
   (`androidx.compose.ui.autofill.ContentType` availability depends on the Compose BOM; with BOM 2024.09.00 use `Modifier.semantics { contentType = ContentType.SmsOtpCode }` if present, else fall back to the `autofill` modifier APIs — verify compilation first and drop the hint if the BOM predates it, noting the follow-up.)
2. Call sites:
   - PhoneScreen.kt:22 → `keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)`, `contentType = ContentType.PhoneNumber`.
   - OtpScreen.kt:37 → `keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)`, `contentType = ContentType.SmsOtpCode`.
   - OtpScreen.kt:39 (name) → `KeyboardOptions(capitalization = KeyboardCapitalization.Words)`, `contentType = ContentType.PersonFullName`.
   - ContactsScreen.kt:32 → `KeyboardCapitalization.Words`.
3. Leave the `contentDescription = placeholder` line in place for now — the entire E2E suite locates fields by it (`onNodeWithContentDescription(Fr.PHONE_PLACEHOLDER)` etc., E2EFlows.kt:225/242/246, FicheE2ETest, OnboardingE2ETest). Removing it is a separate, mechanical migration to `testTag` + real placeholder semantics; note it as follow-up in the PR rather than mixing selector churn into this change.
4. CHANGELOG entry (G5).

## Tests & acceptance criteria

- Instrumented (runs via `scripts/e2e-android.sh`): add to `OnboardingE2ETest` a semantics assertion `test_ONB02_phoneAndOtpFields_declareCorrectKeyboardType`: fetch the phone node's `SemanticsProperties` — keyboard type isn't directly exposed in semantics, so instead assert behaviorally: `performTextInput` still works and the flow completes (regression), and add a Compose UI unit-style check if the BOM exposes `ImeAction`/keyboard config via `SemanticsProperties`. If not assertable, classify as `manual` in docs/qa/e2e-coverage.json with a screenshot in the PR (honest classification, G2).
- Full suites green: `cd apps/android && ./gradlew test` and `scripts/e2e-android.sh` — all existing contentDescription-based selectors must keep working (nothing in this change removes them).

## Risks & gotchas

- Do NOT change any `Fr` placeholder strings (spec-verbatim copy, Fr.kt:12-14).
- `KeyboardType.Phone` keyboards include `+`/digits — exactly what `PhoneHash.normalizePhone` expects; do not add client-side input filtering beyond what exists (`code.take(6)` at OtpScreen.kt:37 stays).
- ContentType/autofill APIs vary across Compose versions — compile-check against the pinned BOM (build.gradle.kts:108) before committing to the hint approach; the keyboard-type half of this suggestion works on any version.
