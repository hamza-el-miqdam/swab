/// UI copy — normative French (product-overview §5), ported VERBATIM from
/// `apps/mobile/src/i18n/fr.ts`. Do not rewrite or "improve" the strings —
/// typographic apostrophes (’) are intentional. Arabic/RTL is on the
/// roadmap; copy stays out of view layout code.
///
/// Ethos check (ONB-09, product law 5): no counters, no percentages, no
/// celebration — enforced by `CopyEthosTests` (no digit-as-progress scan).
public enum I18nKey: String, CaseIterable, Sendable {
    case brandName = "brand.name"

    case welcomeTagline = "welcome.tagline"
    case welcomePromise = "welcome.promise"
    case welcomeCta = "welcome.cta"

    case phoneTitle = "phone.title"
    case phoneHint = "phone.hint"
    case phonePlaceholder = "phone.placeholder"
    case phoneCta = "phone.cta"
    case phoneError = "phone.error"

    case otpTitle = "otp.title"
    case otpPlaceholder = "otp.placeholder"
    case otpCta = "otp.cta"
    case otpError = "otp.error"
    case otpMissingPhone = "otp.missingPhone"
    case otpBackToPhone = "otp.backToPhone"
    case otpNamePrompt = "otp.namePrompt"

    case contactsTitle = "contacts.title"
    case contactsHint = "contacts.hint"
    case contactsImport = "contacts.import"
    case contactsDenied = "contacts.denied"
    case contactsManualPlaceholder = "contacts.manualPlaceholder"
    case contactsAdd = "contacts.add"
    case contactsSkip = "contacts.skip"
    case contactsContinue = "contacts.continue"

    case calibrateTitle = "calibrate.title"
    case calibrateHint = "calibrate.hint"
    case calibrateMe = "calibrate.me"
    case calibrateListMode = "calibrate.listMode"
    case calibrateEmpty = "calibrate.empty"
    case calibrateOptionalLayer = "calibrate.optionalLayer"
    case calibrateOptionalHint = "calibrate.optionalHint"
    case calibrateEtatTitle = "calibrate.etatTitle"
    case calibrateRessentiTitle = "calibrate.ressentiTitle"
    case calibrateRingPrefix = "calibrate.ringPrefix"
    case calibrateContinue = "calibrate.continue"

    case ring1 = "ring.1"
    case ring2 = "ring.2"
    case ring3 = "ring.3"
    case ring4 = "ring.4"

    case etatAvailable = "etat.available"
    case etatBusy = "etat.busy"
    case etatAway = "etat.away"
    case ressentiLight = "ressenti.light"
    case ressentiPrecious = "ressenti.precious"
    case ressentiPaused = "ressenti.paused"

    case doneTitle = "done.title"
    case doneSubtitle = "done.subtitle"
    case donePromise = "done.promise"
    case doneCta = "done.cta"

    // FS-02 — carte (blueprint copy is normative; carte.empty approved addition)
    case carteTitle = "carte.title"
    case carteSubtitle = "carte.subtitle"
    case carteEmpty = "carte.empty"
    case carteMe = "carte.me"
    case carteListMode = "carte.listMode"
    case carteLegend = "carte.legend"
    case carteOpenFiche = "carte.openFiche"
    case carteSheetIntimite = "carte.sheet.intimite"
    case carteSheetEtat = "carte.sheet.etat"
    case carteSheetRoles = "carte.sheet.roles"

    case navCarte = "nav.carte"
    case navEnvie = "nav.envie"
    case navSousGroupes = "nav.sousGroupes"

    case envieTitle = "envie.title"
    case enviePlaceholder = "envie.placeholder"
    case sousgroupesTitle = "sousgroupes.title"
    case sousgroupesPlaceholder = "sousgroupes.placeholder"
}

public enum Fr {
    public static let strings: [I18nKey: String] = [
        .brandName: "swab · صواب",

        .welcomeTagline: "Dis ce dont tu as envie. À qui tu veux.",
        .welcomePromise: "Tout reste chiffré sur ton téléphone.",
        .welcomeCta: "Commencer",

        .phoneTitle: "Ton numéro",
        .phoneHint: "Il est haché sur ton téléphone avant tout envoi — nous ne voyons jamais ton numéro.",
        .phonePlaceholder: "+33 6 12 34 56 78",
        .phoneCta: "Recevoir un code",
        .phoneError: "Ça n’a pas marché. Réessaie dans un instant.",

        .otpTitle: "Le code reçu par SMS",
        .otpPlaceholder: "······",
        .otpCta: "Vérifier",
        .otpError: "Ce code ne correspond pas. Réessaie doucement.",
        .otpMissingPhone: "Reprenons depuis ton numéro.",
        .otpBackToPhone: "Saisir mon numéro",
        .otpNamePrompt: "Ton prénom",

        .contactsTitle: "Qui compte pour toi ?",
        .contactsHint: "Rien ne quitte ton téléphone. Les numéros sont hachés localement.",
        .contactsImport: "Importer mes contacts",
        .contactsDenied: "Pas d’accès aux contacts — aucun souci. Tu peux ajouter les personnes à la main.",
        .contactsManualPlaceholder: "Un prénom…",
        .contactsAdd: "Ajouter",
        .contactsSkip: "Passer",
        .contactsContinue: "Continuer",

        .calibrateTitle: "Place chaque personne autour de toi",
        .calibrateHint: "Touche une personne, puis l’anneau qui lui correspond.",
        .calibrateMe: "moi",
        .calibrateListMode: "Affichage en liste",
        .calibrateEmpty: "Tu pourras placer du monde plus tard, depuis ta carte.",
        .calibrateOptionalLayer: "État · ressenti (optionnel)",
        .calibrateOptionalHint: "Choisis d’abord une personne.",
        .calibrateEtatTitle: "État",
        .calibrateRessentiTitle: "Ressenti",
        .calibrateRingPrefix: "Anneau",
        .calibrateContinue: "Continuer",

        .ring1: "Très proche",
        .ring2: "Proche",
        .ring3: "Familier",
        .ring4: "Plus loin",

        .etatAvailable: "disponible",
        .etatBusy: "occupé",
        .etatAway: "ailleurs",
        .ressentiLight: "léger",
        .ressentiPrecious: "précieux",
        .ressentiPaused: "en pause",

        .doneTitle: "Voilà, c’est posé.",
        .doneSubtitle: "Ta carte est prête.",
        .donePromise: "Personne — ni eux, ni nous — ne voit comment tu l’as remplie.",
        .doneCta: "Voir ma carte",

        .carteTitle: "Ma carte",
        .carteSubtitle: "ton cercle, à l’instant",
        .carteEmpty: "Ta carte est calme. Ajoute qui compte pour toi, quand tu veux.",
        .carteMe: "moi",
        .carteListMode: "Affichage en liste",
        .carteLegend: "Légende des états",
        .carteOpenFiche: "Ouvrir la fiche",
        .carteSheetIntimite: "Intimité",
        .carteSheetEtat: "État",
        .carteSheetRoles: "Rôles",

        .navCarte: "Carte",
        .navEnvie: "Envie",
        .navSousGroupes: "Sous-groupes",

        .envieTitle: "Envie",
        .enviePlaceholder: "Les envies arrivent bientôt.",
        .sousgroupesTitle: "Sous-groupes",
        .sousgroupesPlaceholder: "Les sous-groupes arrivent bientôt.",
    ]

    public static func t(_ key: I18nKey) -> String {
        strings[key] ?? ""
    }
}
