/// OQ-FCH-1 (RESOLVED 2026-08-09, issue #15): Rôles·contexte and Ressenti
/// vocabularies extracted verbatim from the blueprint's embedded
/// `Component extends DCLogic` script (`blueprints/swab - Fiche contact
/// (standalone) (1).html`, `ROLES`/`VALENCES` consts) — no longer invented
/// placeholders.
///
/// - Rôles·contexte (multi-select, 6): famille, partenaire, collègue,
///   promo, communauté, voisin.
/// - Ressenti (3, full swap — replaces the placeholder léger/précieux
///   entirely, not an addition): positive, ambivalente, négative.
/// - État: 4 values (disponible/occupé/ailleurs/en pause) per OQ-FCH-2
///   (resolved 2026-08-09, issue #16). The blueprint's richer 5-état
///   taxonomy stays a flagged divergence (`rn-native-handoff.md` §5).
///
/// FCH-09 (2026-08-16): the vocabularies now live as typed enums in
/// `ClassificationValues.swift` — this type is the display-side view of
/// them, derived rather than duplicated so the two can no longer drift.
/// The `*Labels` arrays are UI copy for chip rows; the stored values are
/// the enums' identifiers.
public enum FicheVocabulary {
    public static let roles: [RoleContexte] = RoleContexte.allCases
    public static let etats: [Etat] = Etat.allCases
    public static let ressentis: [Ressenti] = Ressenti.allCases

    public static let roleLabels: [String] = RoleContexte.labels
    public static let etatLabels: [String] = Etat.labels
    public static let ressentiLabels: [String] = Ressenti.labels
}
