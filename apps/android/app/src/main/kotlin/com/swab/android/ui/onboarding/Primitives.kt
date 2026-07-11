package com.swab.android.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.swab.android.l10n.Fr

/**
 * Shared onboarding building blocks — start/end padding only (RTL-safe,
 * android-specialist.md layout rule), port of the apps/mobile/src/ui UI kit.
 */
@Composable
fun OnboardingScreen(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
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

@Composable
fun InputField(value: String, placeholder: String, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        modifier = Modifier.semantics { contentDescription = placeholder },
    )
}
