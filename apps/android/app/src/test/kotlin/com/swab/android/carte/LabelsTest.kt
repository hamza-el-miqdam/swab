package com.swab.android.carte

import com.swab.android.l10n.Fr
import com.swab.android.vault.VaultContact
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * MAP-08 — the shared accessibility vocabulary: every contact announces
 * name + ring identically in map and list. Port of
 * apps/mobile/src/map/labels.ts's contract.
 */
class LabelsTest {

    @Test
    fun `contactLabel for a placed contact is 'name — ring label'`() {
        val contact = VaultContact(id = "1", displayName = "Léa", ring = 1)
        assertEquals("Léa — ${Fr.RING_1}", Labels.contactLabel(contact))
    }

    @Test
    fun `contactLabel for an unplaced contact is just the name`() {
        val contact = VaultContact(id = "1", displayName = "Léa")
        assertEquals("Léa", Labels.contactLabel(contact))
    }

    @Test
    fun `initials takes up to two initials, uppercased`() {
        assertEquals("LM", Labels.initials("Léa Martin"))
        assertEquals("N", Labels.initials("Nadia"))
    }

    @Test
    fun `initials ignores extra whitespace and takes only the first two name parts`() {
        assertEquals("JP", Labels.initials("  Jean   Pierre Dupont "))
    }

    @Test
    fun `initials of an empty string is empty`() {
        assertEquals("", Labels.initials(""))
        assertEquals("", Labels.initials("   "))
    }

    @Test
    fun `RING_LABEL covers all four rings with the ported French copy`() {
        assertEquals(Fr.RING_1, Labels.RING_LABEL[1])
        assertEquals(Fr.RING_2, Labels.RING_LABEL[2])
        assertEquals(Fr.RING_3, Labels.RING_LABEL[3])
        assertEquals(Fr.RING_4, Labels.RING_LABEL[4])
    }
}
