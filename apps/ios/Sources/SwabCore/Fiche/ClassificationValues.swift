/// FCH-09 — the **stored** representation of the three string classification
/// axes (État, Ressenti, Rôles·contexte). See FS-03 § *Stored value
/// vocabulary* for the normative table; this file is its iOS half and must
/// stay identical to `apps/android/.../fiche/ClassificationValues.kt`.
///
/// Why this type exists: until 2026-08-16 both apps persisted the French
/// **display copy** (`"occupé"`, not `"busy"`) and keyed rendering and logic
/// off it. Rewording a label — or shipping the planned Arabic locale —
/// silently orphaned every stored value: the contact kept its data but
/// rendered as unset through `EtatColors`'s fallback. ADR-001 turns these
/// values into database columns, at which point the same rewording stops
/// being a client bug and becomes a data migration. Hence the split: the
/// identifier is what is stored, `label` is what is drawn.
///
/// Intimité is deliberately absent — it is already a language-neutral
/// `1...4` ring (ONB-04) and needs no mapping.
import Foundation

/// Shared behaviour of a stored classification vocabulary. The concrete
/// enums below are the only conformances; the protocol exists so parsing,
/// normalisation and the parity assertions are written once.
public protocol ClassificationValue: RawRepresentable, CaseIterable, Hashable, Sendable
where RawValue == String {
    /// Normative French copy, resolved at render time — never persisted.
    var label: String { get }

    /// **FROZEN 2026-08-16. Never regenerate this from `Fr`.** These are the
    /// display strings that were persisted before FCH-09, kept verbatim so a
    /// value written by an older build still resolves. Deriving them from the
    /// current copy instead would re-create the exact coupling this type
    /// removes: reword `label`, and yesterday's data stops parsing.
    static var legacyFrenchTokens: [String: Self] { get }
}

extension ClassificationValue {
    /// Identifier first, then the frozen pre-FCH-09 French token. `nil` for
    /// anything else — including vocabulary retired before FCH-09 (`léger`,
    /// `douceur`), which is correctly unmappable rather than guessed at.
    public static func parse(stored raw: String) -> Self? {
        Self(rawValue: raw) ?? legacyFrenchTokens[raw]
    }

    /// Storage normalisation: a recognised token becomes its identifier, an
    /// unrecognised one is returned **verbatim**. Unknown values are never
    /// dropped (FCH-09) — they round-trip untouched and simply render unset.
    public static func normalize(stored raw: String) -> String {
        parse(stored: raw)?.rawValue ?? raw
    }

    /// Display string → value, for chip rows (which are built from `labels`).
    public static func fromLabel(_ label: String) -> Self? {
        allCases.first { $0.label == label }
    }

    public static var labels: [String] { allCases.map(\.label) }

    public static var identifiers: [String] { allCases.map(\.rawValue) }
}

/// État — 4 values. `en pause` lives on this axis, not Ressenti (OQ-FCH-2).
public enum Etat: String, ClassificationValue {
    case available
    case busy
    case away
    case paused

    public var label: String {
        switch self {
        case .available: return Fr.t(.etatAvailable)
        case .busy: return Fr.t(.etatBusy)
        case .away: return Fr.t(.etatAway)
        case .paused: return Fr.t(.etatPaused)
        }
    }

    public static let legacyFrenchTokens: [String: Etat] = [
        "disponible": .available,
        "occupé": .busy,
        "ailleurs": .away,
        "en pause": .paused,
    ]
}

/// Ressenti — 3 values (OQ-FCH-1, blueprint `VALENCES`).
///
/// Note the deliberate asymmetry flagged in FS-03: the *copy key* suffix is
/// the French `ressenti.ambivalente`, while the stored identifier is
/// `ambivalent`. Keys and identifiers are different things.
public enum Ressenti: String, ClassificationValue {
    case positive
    case ambivalent
    case negative

    public var label: String {
        switch self {
        case .positive: return Fr.t(.ressentiPositive)
        case .ambivalent: return Fr.t(.ressentiAmbivalente)
        case .negative: return Fr.t(.ressentiNegative)
        }
    }

    public static let legacyFrenchTokens: [String: Ressenti] = [
        "positive": .positive,
        "ambivalente": .ambivalent,
        "négative": .negative,
    ]
}

/// Rôles·contexte — 6 values, multi-select (OQ-FCH-1, blueprint `ROLES`).
///
/// `cohort` renders « promo » (the French student sense: the year-group you
/// graduated with) and `neighbor` uses the US spelling — the two judgment
/// calls recorded in FS-03, cheap to overrule while no production data exists.
public enum RoleContexte: String, ClassificationValue {
    case family
    case partner
    case colleague
    case cohort
    case community
    case neighbor

    public var label: String {
        switch self {
        case .family: return Fr.t(.roleFamille)
        case .partner: return Fr.t(.rolePartenaire)
        case .colleague: return Fr.t(.roleCollegue)
        case .cohort: return Fr.t(.rolePromo)
        case .community: return Fr.t(.roleCommunaute)
        case .neighbor: return Fr.t(.roleVoisin)
        }
    }

    public static let legacyFrenchTokens: [String: RoleContexte] = [
        "famille": .family,
        "partenaire": .partner,
        "collègue": .colleague,
        "promo": .cohort,
        "communauté": .community,
        "voisin": .neighbor,
    ]
}
