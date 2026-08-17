package com.swab.android.carte

import com.swab.android.fiche.Etat
import com.swab.android.fiche.Ressenti
import com.swab.android.fiche.RoleContexte

/**
 * SUG-AND-017 — the shipped classification vocabularies (ONB-04/06,
 * FCH-01/06), defined exactly once. Previously copy-pasted verbatim across
 * `CalibrateScreen.kt` and `FicheScreen.kt` with a "don't let them diverge"
 * comment — a typo'd or partially-updated copy would have silently split the
 * vocabulary between screens, and these strings key `EtatColors.ETAT_COLORS`
 * and `FicheFilterConsequence.forValue`, plus the vault contents itself. No
 * Android/Compose imports (same JVM-testable convention as [EtatColors]/
 * [Labels]).
 *
 * The 3-état set the blueprint originally shipped with vs the richer
 * blueprint taxonomy is a separate, already-flagged divergence (see
 * [EtatColors]'s header) — do not extend either list here without a product
 * decision.
 */
object Vocab {
    // OQ-FCH-2 (resolved 2026-08-09, issue #16): État carries 4 values (`en
    // pause` moved here from Ressenti). OQ-FCH-1 (resolved 2026-08-09, issue
    // #15): Ressenti carries the 3 real values from the blueprint's VALENCES
    // const, replacing the léger/précieux placeholder pair entirely.
    //
    // FCH-09 (2026-08-16): the vocabularies now live as enums in
    // `fiche/ClassificationValues.kt`. These lists are the display-side view
    // of them, DERIVED rather than duplicated so the two can no longer drift.
    // `*_LABELS` is UI copy for chip rows; the stored values are the ids.
    val ETATS: List<Etat> = Etat.entries
    val RESSENTIS: List<Ressenti> = Ressenti.entries
    val ROLES: List<RoleContexte> = RoleContexte.entries

    val ETAT_LABELS: List<String> get() = Etat.labels
    val RESSENTI_LABELS: List<String> get() = Ressenti.labels
    val ROLE_LABELS: List<String> get() = RoleContexte.labels
}
