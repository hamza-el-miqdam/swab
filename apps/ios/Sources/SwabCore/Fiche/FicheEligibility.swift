/// FCH-08 — a contact who hasn't joined swab yet still gets a full fiche
/// (axes fully editable); only envie eligibility is inactive until they
/// join. `targetId` mirrors FS-07's `ContactLink.targetId`: nil while
/// pending (IDT-07), non-nil once the link resolves to a real user.
public enum FicheEligibility {
    public static func isEnvieActive(targetId: String?) -> Bool {
        targetId != nil
    }
}
