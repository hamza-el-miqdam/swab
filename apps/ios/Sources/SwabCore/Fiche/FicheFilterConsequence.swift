/// FCH-06 — informational-only text surfacing the FS-06 filter consequence
/// for the current état, so filtering stays legible even though FS-06
/// (real envie filtering) isn't built yet. This produces display text only;
/// no filtering logic lives here or anywhere in this client.
///
/// DIVERGENCE FLAG (documented, not silently resolved — see
/// `EtatColors.swift`'s own divergence flag for the same root cause): the
/// spec names `en pause` an ÉTAT value ("État values include at least the
/// blueprint-attested `en pause`"), but the vocabulary actually SHIPPED in
/// Wave 1 (`CalibrateView`, `EtatColors`) put "en pause" under RESSENTI
/// (`Fr.ressentiPaused`), not état (`Fr.etatAvailable/.etatBusy/.etatAway`
/// has no pause value). Per the task brief's instruction to reuse the
/// existing 3-value état set rather than invent a new one, this checks
/// BOTH `etat` and `ressenti` for the "en pause" value so the FCH-06
/// consequence text is legible regardless of which axis currently holds it
/// — a product decision should resolve which axis "en pause" belongs to
/// (tracked as a follow-up alongside OQ-FCH-1), not this code.
public enum FicheFilterConsequence {
    public static func text(etat: String?, ressenti: String?) -> String? {
        guard etat == Fr.t(.ressentiPaused) || ressenti == Fr.t(.ressentiPaused) else {
            return nil
        }
        return Fr.t(.ficheEtatPausedConsequence)
    }
}
