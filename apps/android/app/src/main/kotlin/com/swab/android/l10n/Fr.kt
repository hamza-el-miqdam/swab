package com.swab.android.l10n

/**
 * UI copy — normative French (product-overview §5), ported VERBATIM from
 * apps/mobile/src/i18n/fr.ts (typographic apostrophes ’ included). This flat
 * object is the seam for a full localization setup later; Arabic/RTL is on
 * the roadmap so layouts stay start/end, never left/right.
 *
 * Ethos check (ONB-09, product law 5): no counters, no percentages, no
 * celebration — enforced by NoGamificationCopyTest.
 *
 * DO NOT rewrite or "improve" any string here. Copy changes come from the
 * specs only.
 */
object Fr {
    const val BRAND_NAME: String = "swab · صواب"

    const val WELCOME_TAGLINE: String = "Dis ce dont tu as envie. À qui tu veux."
    const val WELCOME_PROMISE: String = "Tout reste chiffré sur ton téléphone."
    const val WELCOME_CTA: String = "Commencer"

    const val PHONE_TITLE: String = "Ton numéro"
    const val PHONE_HINT: String =
        "Il est haché sur ton téléphone avant tout envoi — nous ne voyons jamais ton numéro."
    const val PHONE_PLACEHOLDER: String = "+33 6 12 34 56 78"
    const val PHONE_CTA: String = "Recevoir un code"
    const val PHONE_ERROR: String = "Ça n’a pas marché. Réessaie dans un instant."

    const val OTP_TITLE: String = "Le code reçu par SMS"
    const val OTP_PLACEHOLDER: String = "······"
    const val OTP_CTA: String = "Vérifier"
    const val OTP_ERROR: String = "Ce code ne correspond pas. Réessaie doucement."
    const val OTP_MISSING_PHONE: String = "Reprenons depuis ton numéro."
    const val OTP_BACK_TO_PHONE: String = "Saisir mon numéro"
    const val OTP_NAME_PROMPT: String = "Ton prénom"

    const val CONTACTS_TITLE: String = "Qui compte pour toi ?"
    const val CONTACTS_HINT: String = "Rien ne quitte ton téléphone. Les numéros sont hachés localement."
    const val CONTACTS_IMPORT: String = "Importer mes contacts"
    const val CONTACTS_DENIED: String =
        "Pas d’accès aux contacts — aucun souci. Tu peux ajouter les personnes à la main."
    const val CONTACTS_MANUAL_PLACEHOLDER: String = "Un prénom…"
    const val CONTACTS_ADD: String = "Ajouter"
    const val CONTACTS_SKIP: String = "Passer"
    const val CONTACTS_CONTINUE: String = "Continuer"

    const val CALIBRATE_TITLE: String = "Place chaque personne autour de toi"
    const val CALIBRATE_HINT: String = "Touche une personne, puis l’anneau qui lui correspond."
    const val CALIBRATE_ME: String = "moi"
    const val CALIBRATE_LIST_MODE: String = "Affichage en liste"
    const val CALIBRATE_EMPTY: String = "Tu pourras placer du monde plus tard, depuis ta carte."
    const val CALIBRATE_OPTIONAL_LAYER: String = "État · ressenti (optionnel)"
    const val CALIBRATE_OPTIONAL_HINT: String = "Choisis d’abord une personne."
    const val CALIBRATE_ETAT_TITLE: String = "État"
    const val CALIBRATE_RESSENTI_TITLE: String = "Ressenti"
    const val CALIBRATE_RING_PREFIX: String = "Anneau"
    const val CALIBRATE_CONTINUE: String = "Continuer"

    const val RING_1: String = "Très proche"
    const val RING_2: String = "Proche"
    const val RING_3: String = "Familier"
    const val RING_4: String = "Plus loin"

    const val ETAT_AVAILABLE: String = "disponible"
    const val ETAT_BUSY: String = "occupé"
    const val ETAT_AWAY: String = "ailleurs"
    const val RESSENTI_LIGHT: String = "léger"
    const val RESSENTI_PRECIOUS: String = "précieux"
    const val RESSENTI_PAUSED: String = "en pause"

    const val DONE_TITLE: String = "Voilà, c’est posé."
    const val DONE_SUBTITLE: String = "Ta carte est prête."
    const val DONE_PROMISE: String = "Personne — ni eux, ni nous — ne voit comment tu l’as remplie."
    const val DONE_CTA: String = "Voir ma carte"

    const val CARTE_TITLE: String = "Ma carte"
    const val CARTE_SUBTITLE: String = "ton cercle, à l’instant"
    const val CARTE_EMPTY: String = "Ta carte est calme. Ajoute qui compte pour toi, quand tu veux."
    const val CARTE_ME: String = "moi"
    const val CARTE_LIST_MODE: String = "Affichage en liste"
    const val CARTE_LEGEND: String = "Légende des états"
    const val CARTE_OPEN_FICHE: String = "Ouvrir la fiche"
    const val CARTE_SHEET_INTIMITE: String = "Intimité"
    const val CARTE_SHEET_ETAT: String = "État"
    const val CARTE_SHEET_ROLES: String = "Rôles"

    const val FICHE_BACK: String = "Retour"
    const val FICHE_AXIS_INTIMITE: String = "Intimité"
    const val FICHE_AXIS_ROLES: String = "Rôles·contexte"
    const val FICHE_AXIS_ETAT: String = "État"
    const val FICHE_AXIS_RESSENTI: String = "Ressenti"
    // OQ-FCH-1: placeholder Rôles·contexte taxonomy — product hasn't fixed
    // the vocabulary yet, per the spec's own open question.
    const val FICHE_ROLE_FAMILLE: String = "Famille"
    const val FICHE_ROLE_AMITIE: String = "Amitié"
    const val FICHE_ROLE_TRAVAIL: String = "Travail"
    const val FICHE_ROLE_VOISINAGE: String = "Voisinage"
    const val FICHE_ROLE_AUTRE: String = "Autre"
    const val FICHE_HISTORY_TITLE: String = "Le fil de ce qui a bougé"
    const val FICHE_HISTORY_EMPTY: String = "Rien n’a encore bougé."
    // ⚠️ ASSUMPTION: exact nudge copy isn't in the spec (only the two button
    // labels are quoted verbatim below) — this title is a neutral placeholder.
    const val FICHE_STALE_TITLE: String = "Ça n’a pas changé depuis un moment."
    const val FICHE_STALE_CONFIRM: String = "C’est toujours ça"
    const val FICHE_STALE_DISMISS: String = "À revoir plus tard"
    const val FICHE_ETAT_PAUSED_CONSEQUENCE: String = "en pause → exclu par défaut à l’envoi"
    const val FICHE_PENDING_LABEL: String = "N’a pas encore rejoint swab"
    const val FICHE_ENVIE_INACTIVE: String = "Envie indisponible tant que cette personne n’a pas rejoint swab."

    const val NAV_CARTE: String = "Carte"
    const val NAV_ENVIE: String = "Envie"
    const val NAV_SOUS_GROUPES: String = "Sous-groupes"

    const val ENVIE_TITLE: String = "Envie"
    const val ENVIE_PLACEHOLDER: String = "Les envies arrivent bientôt."
    const val SOUSGROUPES_TITLE: String = "Sous-groupes"
    const val SOUSGROUPES_PLACEHOLDER: String = "Les sous-groupes arrivent bientôt."

    /** All string constants — used by NoGamificationCopyTest (ONB-09). */
    val ALL_STRINGS: List<String> by lazy {
        listOf(
            BRAND_NAME, WELCOME_TAGLINE, WELCOME_PROMISE, WELCOME_CTA,
            PHONE_TITLE, PHONE_HINT, PHONE_PLACEHOLDER, PHONE_CTA, PHONE_ERROR,
            OTP_TITLE, OTP_PLACEHOLDER, OTP_CTA, OTP_ERROR, OTP_MISSING_PHONE, OTP_BACK_TO_PHONE, OTP_NAME_PROMPT,
            CONTACTS_TITLE, CONTACTS_HINT, CONTACTS_IMPORT, CONTACTS_DENIED, CONTACTS_MANUAL_PLACEHOLDER,
            CONTACTS_ADD, CONTACTS_SKIP, CONTACTS_CONTINUE,
            CALIBRATE_TITLE, CALIBRATE_HINT, CALIBRATE_ME, CALIBRATE_LIST_MODE, CALIBRATE_EMPTY,
            CALIBRATE_OPTIONAL_LAYER, CALIBRATE_OPTIONAL_HINT, CALIBRATE_ETAT_TITLE, CALIBRATE_RESSENTI_TITLE,
            CALIBRATE_RING_PREFIX, CALIBRATE_CONTINUE,
            RING_1, RING_2, RING_3, RING_4,
            ETAT_AVAILABLE, ETAT_BUSY, ETAT_AWAY, RESSENTI_LIGHT, RESSENTI_PRECIOUS, RESSENTI_PAUSED,
            DONE_TITLE, DONE_SUBTITLE, DONE_PROMISE, DONE_CTA,
            CARTE_TITLE, CARTE_SUBTITLE, CARTE_EMPTY, CARTE_ME, CARTE_LIST_MODE, CARTE_LEGEND,
            CARTE_OPEN_FICHE, CARTE_SHEET_INTIMITE, CARTE_SHEET_ETAT, CARTE_SHEET_ROLES,
            FICHE_BACK, FICHE_AXIS_INTIMITE, FICHE_AXIS_ROLES, FICHE_AXIS_ETAT, FICHE_AXIS_RESSENTI,
            FICHE_ROLE_FAMILLE, FICHE_ROLE_AMITIE, FICHE_ROLE_TRAVAIL, FICHE_ROLE_VOISINAGE, FICHE_ROLE_AUTRE,
            FICHE_HISTORY_TITLE, FICHE_HISTORY_EMPTY, FICHE_STALE_TITLE, FICHE_STALE_CONFIRM, FICHE_STALE_DISMISS,
            FICHE_ETAT_PAUSED_CONSEQUENCE, FICHE_PENDING_LABEL, FICHE_ENVIE_INACTIVE,
            NAV_CARTE, NAV_ENVIE, NAV_SOUS_GROUPES,
            ENVIE_TITLE, ENVIE_PLACEHOLDER, SOUSGROUPES_TITLE, SOUSGROUPES_PLACEHOLDER,
        )
    }
}
