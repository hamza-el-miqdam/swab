package com.swab.android.ui.sousgroupes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.swab.android.l10n.Fr

/** FS-04 seam (Wave 3+) — calm placeholder, nav destination only. */
@Composable
fun SousGroupesScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(Fr.SOUSGROUPES_TITLE, style = MaterialTheme.typography.headlineSmall)
        Text(Fr.SOUSGROUPES_PLACEHOLDER, style = MaterialTheme.typography.bodyMedium)
    }
}
