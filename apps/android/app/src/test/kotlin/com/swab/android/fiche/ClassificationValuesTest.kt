package com.swab.android.fiche

import com.swab.android.carte.EtatColors
import com.swab.android.l10n.Fr
import com.swab.android.vault.VaultContact
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * FCH-09 — stored classification values are stable identifiers, decoupled
 * from the French display copy (ADR-001 stage 0b).
 *
 * The identifier lists below are the CROSS-PLATFORM CONTRACT, copied from
 * FS-03 § *Stored value vocabulary*. `ClassificationValuesTests.swift` on iOS
 * asserts the same literals. If you change one, the other fails — which is the
 * point: a divergence must break a build, not become data that only one client
 * can read.
 */
class ClassificationValuesTest {

    private val json = Json { ignoreUnknownKeys = true }

    // ------------------------------------------------- the frozen contract

    @Test
    fun `FCH-09 etat identifiers match the spec table`() {
        assertEquals(listOf("available", "busy", "away", "paused"), Etat.identifiers)
    }

    @Test
    fun `FCH-09 ressenti identifiers match the spec table`() {
        assertEquals(listOf("positive", "ambivalent", "negative"), Ressenti.identifiers)
    }

    @Test
    fun `FCH-09 role identifiers match the spec table`() {
        assertEquals(
            listOf("family", "partner", "colleague", "cohort", "community", "neighbor"),
            RoleContexte.identifiers,
        )
    }

    /** The whole point of the requirement: no identifier is ever also copy. */
    @Test
    fun `FCH-09 no identifier is also its own display label, except where French and English coincide`() {
        // « positive » is spelled identically in both languages; everything
        // else must differ, or the decoupling is only nominal.
        val coincidental = setOf("positive")
        for (value in Etat.entries) assertNotEquals("Etat.$value", value.id, value.label)
        for (value in Ressenti.entries.filter { it.id !in coincidental }) {
            assertNotEquals("Ressenti.$value", value.id, value.label)
        }
        for (value in RoleContexte.entries) assertNotEquals("RoleContexte.$value", value.id, value.label)
    }

    // ------------------------------------------- dual read (the migration)

    @Test
    fun `FCH-09 legacy French etat strings parse to identifiers`() {
        assertEquals(Etat.AVAILABLE, Etat.parse("disponible"))
        assertEquals(Etat.BUSY, Etat.parse("occupé"))
        assertEquals(Etat.AWAY, Etat.parse("ailleurs"))
        assertEquals(Etat.PAUSED, Etat.parse("en pause"))
    }

    @Test
    fun `FCH-09 legacy French ressenti and role strings parse to identifiers`() {
        assertEquals(Ressenti.AMBIVALENT, Ressenti.parse("ambivalente"))
        assertEquals(Ressenti.NEGATIVE, Ressenti.parse("négative"))
        assertEquals(RoleContexte.COLLEAGUE, RoleContexte.parse("collègue"))
        assertEquals(RoleContexte.COHORT, RoleContexte.parse("promo"))
        assertEquals(RoleContexte.COMMUNITY, RoleContexte.parse("communauté"))
        assertEquals(RoleContexte.NEIGHBOR, RoleContexte.parse("voisin"))
    }

    /**
     * The one real difference from the iOS half, and the reason this test
     * exists separately. Swift's `String ==` compares by canonical
     * equivalence, so « occupé » matches whether it was stored NFC (U+00E9) or
     * NFD (U+0065 U+0301). **Kotlin compares UTF-16 code units and does not.**
     * Without the NFC pass in [ClassificationVocabulary], an NFD-encoded legacy
     * token would silently fail to migrate and be treated as unknown.
     */
    @Test
    fun `FCH-09 legacy French tokens parse regardless of Unicode normalisation form`() {
        // Built from escapes on purpose: the two forms are visually identical,
        // so a literal would silently be whatever the editor happened to save.
        val nfd = "occupe\u0301" // o c c u p e + U+0301 COMBINING ACUTE ACCENT
        val nfc = "occup\u00e9" // o c c u p + U+00E9 LATIN SMALL LETTER E WITH ACUTE
        assertNotEquals("precondition: Kotlin compares code units, so these differ", nfc, nfd)
        assertEquals(Etat.BUSY, Etat.parse(nfc))
        assertEquals(Etat.BUSY, Etat.parse(nfd))
        assertEquals(RoleContexte.COMMUNITY, RoleContexte.parse("communaute\u0301"))
    }

    @Test
    fun `FCH-09 a legacy contact decodes to identifiers and re-encodes as identifiers`() {
        val legacy = """
            {"id":"c1","displayName":"Leïla","ring":2,"roles":["famille","collègue"],
             "etat":"occupé","ressenti":"négative"}
        """.trimIndent()
        val decoded = json.decodeFromString<VaultContact>(legacy)

        // The contact itself is decoded verbatim by kotlinx.serialization;
        // normalisation happens at the vault's single hydration point, so
        // assert the parsing contract the vault relies on.
        assertEquals("busy", Etat.normalize(decoded.etat!!))
        assertEquals("negative", Ressenti.normalize(decoded.ressenti!!))
        assertEquals(listOf("family", "colleague"), decoded.roles.map { RoleContexte.normalize(it) })
    }

    /**
     * FCH-09's no-data-loss clause. `douceur` and `confidente` are real
     * pre-OQ-FCH-1 values still present in `vault-test-vectors.json`; they map
     * to nothing in today's vocabulary and must survive untouched rather than
     * being dropped or guessed at.
     */
    @Test
    fun `FCH-09 an unknown token is preserved verbatim and renders unset`() {
        assertEquals("not-a-real-etat", Etat.normalize("not-a-real-etat"))
        assertEquals("douceur", Ressenti.normalize("douceur"))
        assertEquals("confidente", RoleContexte.normalize("confidente"))

        val contact = VaultContact(
            id = "c2",
            displayName = "X",
            roles = listOf("confidente"),
            etat = "not-a-real-etat",
            ressenti = "douceur",
        )
        assertNull("unmappable -> renders unset, never a crash", contact.etatValue)
        assertNull(contact.ressentiValue)
        assertTrue(contact.roleValues.isEmpty())

        val reEncoded = json.encodeToString(VaultContact.serializer(), contact)
        assertTrue("a read must never destroy an unknown value", reEncoded.contains("douceur"))
        assertTrue(reEncoded.contains("confidente"))
    }

    /**
     * The legacy table must stay a frozen literal. Deriving it from [Fr] would
     * re-create the exact coupling FCH-09 removes.
     */
    @Test
    fun `FCH-09 the legacy table is frozen, not derived from current copy`() {
        assertEquals(4, Etat.legacyTokenCount)
        assertEquals(3, Ressenti.legacyTokenCount)
        assertEquals(6, RoleContexte.legacyTokenCount)
        // Today the frozen tokens still equal today's copy — that is what makes
        // the migration a no-op for anyone who never reworded anything.
        for (value in Etat.entries) assertEquals(value, Etat.parse(value.label))
    }

    // ------------------------------------- MAP-03 / FCH-06 on identifiers

    @Test
    fun `MAP-03 color lookup by identifier never falls back for a known etat`() {
        for (etat in Etat.entries) {
            assertTrue(
                "${etat.id} must resolve to its palette color, not the neutral fallback",
                EtatColors.etatColor(etat).background != null,
            )
        }
    }

    @Test
    fun `FCH-09 labels resolve through Fr, so copy stays the single source of display`() {
        assertEquals(Fr.ETAT_BUSY, Etat.BUSY.label)
        assertEquals(Fr.RESSENTI_AMBIVALENT, Ressenti.AMBIVALENT.label)
        assertEquals(Fr.ROLE_PROMO, RoleContexte.COHORT.label)
    }

    @Test
    fun `FCH-09 fromLabel round-trips every value`() {
        for (value in Etat.entries) assertEquals(value, Etat.fromLabel(value.label))
        for (value in Ressenti.entries) assertEquals(value, Ressenti.fromLabel(value.label))
        for (value in RoleContexte.entries) assertEquals(value, RoleContexte.fromLabel(value.label))
        assertNull(Etat.fromLabel("pas un état"))
    }
}
