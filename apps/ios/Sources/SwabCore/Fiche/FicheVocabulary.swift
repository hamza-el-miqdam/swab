/// OQ-FCH-1 (spec, unresolved): exact vocabulary sets for Rôles·contexte and
/// Ressenti weren't extracted from the blueprint before implementation.
///
/// ⚠️ ASSUMPTION — placeholder taxonomies, per the task brief:
/// - Rôles·contexte (multi-select): Famille / Amitié / Travail / Voisinage /
///   Autre — invented for this walking skeleton, not blueprint-sourced.
/// - État / Ressenti: deliberately NOT a new list — reuses the exact
///   values already shipped in Wave 1's calibration screen
///   (`CalibrateView`'s private `etats`/`ressentis` arrays) and in
///   `EtatColors.byLabel`, so the fiche and the map/calibrate screens never
///   disagree about what an état/ressenti value even is.
///
/// OQ-FCH-2 (resolved 2026-08-09, issue #16): "en pause" moved from
/// Ressenti to État — État is canonical per FCH-06/FLT-01. État now has 4
/// values, Ressenti 2 (léger, précieux); OQ-FCH-1 still leaves Ressenti's
/// final vocabulary open, so no replacement 3rd value was invented here.
public enum FicheVocabulary {
    public static let roles = ["Famille", "Amitié", "Travail", "Voisinage", "Autre"]

    public static let etats = [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway), Fr.t(.etatPaused)]
    public static let ressentis = [Fr.t(.ressentiLight), Fr.t(.ressentiPrecious)]
}
