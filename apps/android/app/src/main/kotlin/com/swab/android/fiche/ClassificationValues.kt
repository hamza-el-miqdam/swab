package com.swab.android.fiche

import com.swab.android.l10n.Fr
import java.text.Normalizer

/**
 * FCH-09 — the **stored** representation of the three string classification
 * axes (État, Ressenti, Rôles·contexte). See FS-03 § *Stored value
 * vocabulary* for the normative table; this file is its Android half and
 * must stay identical to
 * `apps/ios/Sources/SwabCore/Fiche/ClassificationValues.swift`.
 *
 * Why this exists: until 2026-08-16 both apps persisted the French **display
 * copy** (`"occupé"`, not `"busy"`) and keyed rendering and logic off it.
 * Rewording a label — or shipping the planned Arabic locale — silently
 * orphaned every stored value: the contact kept its data but rendered as
 * unset through `EtatColors`'s null fallback. ADR-001 turns these values into
 * database columns, at which point the same rewording stops being a client
 * bug and becomes a data migration. Hence the split: [ClassificationValue.id]
 * is what is stored, [ClassificationValue.label] is what is drawn.
 *
 * Intimité is deliberately absent — already a language-neutral `1..4` ring
 * (ONB-04).
 */
interface ClassificationValue {
    /** Persisted and transmitted. Frozen by FS-03; never derived from copy. */
    val id: String

    /** Normative French copy, resolved at render time — never persisted. */
    val label: String
}

/**
 * Parsing/normalisation shared by the three vocabularies, so the behaviour is
 * written once. Each enum's companion extends this.
 *
 * **Unicode gotcha, and the one real difference from the iOS half:** Swift's
 * `String ==` compares by canonical equivalence, so « occupé » matches whether
 * it was stored as NFC (U+00E9) or NFD (U+0065 U+0301). Kotlin compares UTF-16
 * code units and does **not** — an NFD-encoded legacy token would silently
 * fail to migrate and be treated as unknown. Both the frozen table and every
 * lookup are therefore normalised to NFC.
 */
open class ClassificationVocabulary<T : ClassificationValue>(
    private val values: List<T>,
    legacyFrenchTokens: Map<String, T>,
) {
    /**
     * **FROZEN 2026-08-16. Never regenerate this from [Fr].** These are the
     * display strings persisted before FCH-09, kept verbatim so a value
     * written by an older build still resolves. Deriving them from the current
     * copy instead would re-create the exact coupling this type removes:
     * reword [ClassificationValue.label], and yesterday's data stops parsing.
     */
    private val legacyByNfc: Map<String, T> = legacyFrenchTokens.mapKeys { nfc(it.key) }

    val identifiers: List<String> get() = values.map { it.id }

    val labels: List<String> get() = values.map { it.label }

    val legacyTokenCount: Int get() = legacyByNfc.size

    /**
     * Identifier first, then the frozen pre-FCH-09 French token. `null` for
     * anything else — including vocabulary retired before FCH-09 (`léger`,
     * `douceur`), which is correctly unmappable rather than guessed at.
     */
    fun parse(stored: String?): T? {
        if (stored == null) return null
        return values.firstOrNull { it.id == stored } ?: legacyByNfc[nfc(stored)]
    }

    /**
     * Storage normalisation: a recognised token becomes its identifier, an
     * unrecognised one is returned **verbatim**. Unknown values are never
     * dropped (FCH-09) — they round-trip untouched and simply render unset.
     */
    fun normalize(stored: String): String = parse(stored)?.id ?: stored

    /** Display string → value, for chip rows (which are built from [labels]). */
    fun fromLabel(label: String): T? = values.firstOrNull { it.label == label }

    private fun nfc(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFC)
}

/** État — 4 values. `en pause` lives on this axis, not Ressenti (OQ-FCH-2). */
enum class Etat(override val id: String) : ClassificationValue {
    AVAILABLE("available"),
    BUSY("busy"),
    AWAY("away"),
    PAUSED("paused"),
    ;

    override val label: String
        get() = when (this) {
            AVAILABLE -> Fr.ETAT_AVAILABLE
            BUSY -> Fr.ETAT_BUSY
            AWAY -> Fr.ETAT_AWAY
            PAUSED -> Fr.ETAT_PAUSED
        }

    companion object : ClassificationVocabulary<Etat>(
        entries,
        mapOf(
            "disponible" to AVAILABLE,
            "occupé" to BUSY,
            "ailleurs" to AWAY,
            "en pause" to PAUSED,
        ),
    )
}

/**
 * Ressenti — 3 values (OQ-FCH-1, blueprint `VALENCES`).
 *
 * Note the deliberate asymmetry flagged in FS-03: the iOS *copy key* suffix is
 * the French `ressenti.ambivalente`, while the stored identifier is
 * `ambivalent`. Keys and identifiers are different things.
 */
enum class Ressenti(override val id: String) : ClassificationValue {
    POSITIVE("positive"),
    AMBIVALENT("ambivalent"),
    NEGATIVE("negative"),
    ;

    override val label: String
        get() = when (this) {
            POSITIVE -> Fr.RESSENTI_POSITIVE
            AMBIVALENT -> Fr.RESSENTI_AMBIVALENT
            NEGATIVE -> Fr.RESSENTI_NEGATIVE
        }

    companion object : ClassificationVocabulary<Ressenti>(
        entries,
        mapOf(
            "positive" to POSITIVE,
            "ambivalente" to AMBIVALENT,
            "négative" to NEGATIVE,
        ),
    )
}

/**
 * Rôles·contexte — 6 values, multi-select (OQ-FCH-1, blueprint `ROLES`).
 *
 * `COHORT` renders « promo » (the French student sense: the year-group you
 * graduated with) and `NEIGHBOR` uses the US spelling — the two judgment calls
 * recorded in FS-03, cheap to overrule while no production data exists.
 */
enum class RoleContexte(override val id: String) : ClassificationValue {
    FAMILY("family"),
    PARTNER("partner"),
    COLLEAGUE("colleague"),
    COHORT("cohort"),
    COMMUNITY("community"),
    NEIGHBOR("neighbor"),
    ;

    override val label: String
        get() = when (this) {
            FAMILY -> Fr.ROLE_FAMILLE
            PARTNER -> Fr.ROLE_PARTENAIRE
            COLLEAGUE -> Fr.ROLE_COLLEGUE
            COHORT -> Fr.ROLE_PROMO
            COMMUNITY -> Fr.ROLE_COMMUNAUTE
            NEIGHBOR -> Fr.ROLE_VOISIN
        }

    companion object : ClassificationVocabulary<RoleContexte>(
        entries,
        mapOf(
            "famille" to FAMILY,
            "partenaire" to PARTNER,
            "collègue" to COLLEAGUE,
            "promo" to COHORT,
            "communauté" to COMMUNITY,
            "voisin" to NEIGHBOR,
        ),
    )
}
