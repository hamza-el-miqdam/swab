package com.swab.android.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.swab.android.l10n.Fr

/**
 * Shared onboarding building blocks — start/end padding only (RTL-safe,
 * android-specialist.md layout rule), port of the apps/mobile/src/ui UI kit.
 *
 * Bug fix found during manual on-device verification of SUG-AND-014: adding
 * the 320dp radial canvas to CalibrateScreen (which reuses this wrapper)
 * made its content taller than the viewport with contacts placed, and this
 * Column had no scroll — `Fr.CALIBRATE_CONTINUE` and the per-ring buttons
 * below a selected contact became laid out off-screen with literally no way
 * to reach them (not even a manual swipe), which is exactly what was timing
 * out three E2E tests (`ActivityRecreationSmokeTest`/`FicheE2ETest`, both
 * routed through `completeOnboarding`). `verticalScroll` is a no-op when
 * content already fits, so every other onboarding screen is unaffected.
 */
@Composable
fun OnboardingScreen(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(PaddingValues(start = 24.dp, end = 24.dp, top = 32.dp, bottom = 24.dp)),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

@Composable
fun Brand() {
    Text(Fr.BRAND_NAME, style = MaterialTheme.typography.labelLarge)
}

@Composable
fun ScreenTitle(text: String) {
    Text(text, style = MaterialTheme.typography.headlineSmall)
}

@Composable
fun BodyText(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium)
}

@Composable
fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled, modifier = Modifier.semantics { contentDescription = label }) {
        Text(label)
    }
}

@Composable
fun GhostButton(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.semantics { contentDescription = label }) {
        Text(label)
    }
}

/**
 * SUG-AND-015: [keyboardOptions] picks the right physical keyboard
 * (phone/number/text) instead of defaulting to full QWERTY everywhere.
 * `contentDescription = placeholder` stays (not removed here) — the entire
 * E2E suite locates fields by it; migrating to testTag is a separate,
 * mechanical follow-up (noted, not mixed into this change).
 *
 * Autofill hints (`Modifier.semantics { contentType = ... }`, incl. SMS-OTP
 * one-tap fill) were part of the suggestion's plan but `ContentType` is
 * still `internal` in this project's pinned compose-bom (2024.09.00) —
 * confirmed by a compile failure, not guessed. Dropped rather than forcing
 * a bom bump with no emulator in this environment to verify end-to-end;
 * flagged as a follow-up for whenever the bom next moves.
 */
@Composable
fun InputField(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        keyboardOptions = keyboardOptions,
        modifier = Modifier.semantics { contentDescription = placeholder },
    )
}
