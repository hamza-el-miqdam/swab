/// OQ-FCH-1 (spec, unresolved): exact vocabulary sets for Rôles·contexte and
/// Ressenti weren't extracted from the blueprint before implementation.
///
/// ⚠️ ASSUMPTION — placeholder taxonomies, per the task brief:
/// - Rôles·contexte (multi-select): Famille / Amitié / Travail / Voisinage /
///   Autre — invented for this walking skeleton, not blueprint-sourced.
/// - État / Ressenti: deliberately NOT a new list — reuses the exact
///   3-value sets already shipped in Wave 1's calibration screen
///   (`CalibrateView`'s private `etats`/`ressentis` arrays) and in
///   `EtatColors.byLabel`, so the fiche and the map/calibrate screens never
///   disagree about what an état/ressenti value even is.
public enum FicheVocabulary {
    public static let roles = ["Famille", "Amitié", "Travail", "Voisinage", "Autre"]

    public static let etats = [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway)]
    public static let ressentis = [Fr.t(.ressentiLight), Fr.t(.ressentiPrecious), Fr.t(.ressentiPaused)]
}
