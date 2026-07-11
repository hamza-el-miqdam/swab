package com.swab.android.carte

import com.swab.android.l10n.Fr
import com.swab.android.vault.VaultContact
import java.util.Locale

/**
 * Shared accessibility vocabulary for the carte (MAP-08 acceptance: every
 * contact announces name + ring, identically in map and list). Port of
 * apps/mobile/src/map/labels.ts. No Android imports.
 */
object Labels {
    val RING_LABEL: Map<Int, String> = mapOf(
        1 to Fr.RING_1,
        2 to Fr.RING_2,
        3 to Fr.RING_3,
        4 to Fr.RING_4,
    )

    /** « Léa — Très proche » for placed contacts, plain name otherwise. */
    fun contactLabel(contact: VaultContact): String {
        val ring = contact.ring
        return if (ring != null) "${contact.displayName} — ${RING_LABEL[ring]}" else contact.displayName
    }

    /** Up to two initials — glanceable node content, never the full name. */
    fun initials(displayName: String): String =
        displayName
            .split(Regex("\\s+"))
            .filter { it.isNotEmpty() }
            .take(2)
            .joinToString(separator = "") { part -> part.take(1).uppercase(Locale.FRENCH) }
}
