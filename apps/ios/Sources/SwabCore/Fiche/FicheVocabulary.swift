/// OQ-FCH-1 (RESOLVED 2026-08-09, issue #15): Rôles·contexte and Ressenti
/// vocabularies extracted verbatim from the blueprint's embedded
/// `Component extends DCLogic` script (`blueprints/swab - Fiche contact
/// (standalone) (1).html`, `ROLES`/`VALENCES` consts) — no longer invented
/// placeholders.
///
/// - Rôles·contexte (multi-select, 6): famille, partenaire, collègue,
///   promo, communauté, voisin — routed through `Fr`/`I18nKey` like the
///   other three axes, since this is real, permanent product vocabulary.
/// - Ressenti (3, full swap — replaces the placeholder léger/précieux
///   entirely, not an addition): positive, ambivalente, négative.
/// - État: deliberately NOT touched by this resolution — reuses the exact
///   4 values already shipped (disponible/occupé/ailleurs/en pause, see
///   `CalibrateView`'s private `etats` array and `EtatColors.byLabel`),
///   per OQ-FCH-2 (resolved 2026-08-09, issue #16), a separate divergence
///   tracked in `rn-native-handoff.md` §5.
public enum FicheVocabulary {
    public static let roles = [
        Fr.t(.roleFamille),
        Fr.t(.rolePartenaire),
        Fr.t(.roleCollegue),
        Fr.t(.rolePromo),
        Fr.t(.roleCommunaute),
        Fr.t(.roleVoisin),
    ]

    public static let etats = [Fr.t(.etatAvailable), Fr.t(.etatBusy), Fr.t(.etatAway), Fr.t(.etatPaused)]
    public static let ressentis = [Fr.t(.ressentiPositive), Fr.t(.ressentiAmbivalente), Fr.t(.ressentiNegative)]
}
