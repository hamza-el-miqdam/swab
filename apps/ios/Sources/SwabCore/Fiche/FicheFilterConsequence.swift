/// FCH-06 — informational-only text surfacing the FS-06 filter consequence
/// for the current état, so filtering stays legible even though FS-06
/// (real envie filtering) isn't built yet. This produces display text only;
/// no filtering logic lives here or anywhere in this client.
///
/// OQ-FCH-2 resolved 2026-08-09 per issue #16: État is canonical for
/// "en pause" (FCH-06, FLT-01). The prior dual-axis (état-or-ressenti)
/// workaround is removed — `ressenti` is no longer consulted here.
/// FCH-09: the comparison is against the stored identifier `.paused`, not
/// against `Fr.t(.etatPaused)`. The old string compare meant a copy edit
/// silently stopped showing the consequence — a filtering rule going quiet
/// is precisely the « rien ne disparaît en silence » failure the product
/// forbids.
public enum FicheFilterConsequence {
    public static func text(etat: Etat?, ressenti: Ressenti?) -> String? {
        guard etat == .paused else {
            return nil
        }
        return Fr.t(.ficheEtatPausedConsequence)
    }
}
