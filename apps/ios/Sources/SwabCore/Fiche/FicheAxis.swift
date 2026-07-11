/// The four FCH-01 axes, named identically to the spec's vocabulary
/// (Intimité, Rôles·contexte, État, Ressenti) so history events and UI
/// copy can key off one shared identifier.
public enum FicheAxis: String, Codable, Equatable, Hashable, Sendable {
    case intimite
    case roles
    case etat
    case ressenti
}
