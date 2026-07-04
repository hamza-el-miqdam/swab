/**
 * UI copy — normative French (product-overview §5). This flat map is the
 * seam for the full i18next setup later (Arabic is on the roadmap — layouts
 * stay RTL-safe, copy stays out of components).
 *
 * Ethos check (ONB-09, product law 5): no counters, no percentages, no
 * celebration — enforced by src/__tests__/no-gamification.onb09.test.ts.
 */
export const fr = {
  'brand.name': 'swab · صواب',

  'welcome.tagline': 'Dis ce dont tu as envie. À qui tu veux.',
  'welcome.promise': 'Tout reste chiffré sur ton téléphone.',
  'welcome.cta': 'Commencer',

  'phone.title': 'Ton numéro',
  'phone.hint': 'Il est haché sur ton téléphone avant tout envoi — nous ne voyons jamais ton numéro.',
  'phone.placeholder': '+33 6 12 34 56 78',
  'phone.cta': 'Recevoir un code',
  'phone.error': 'Ça n’a pas marché. Réessaie dans un instant.',

  'otp.title': 'Le code reçu par SMS',
  'otp.placeholder': '······',
  'otp.cta': 'Vérifier',
  'otp.error': 'Ce code ne correspond pas. Réessaie doucement.',
  'otp.missingPhone': 'Reprenons depuis ton numéro.',
  'otp.backToPhone': 'Saisir mon numéro',

  'contacts.title': 'Qui compte pour toi ?',
  'contacts.hint': 'Rien ne quitte ton téléphone. Les numéros sont hachés localement.',
  'contacts.import': 'Importer mes contacts',
  'contacts.denied': 'Pas d’accès aux contacts — aucun souci. Tu peux ajouter les personnes à la main.',
  'contacts.manualPlaceholder': 'Un prénom…',
  'contacts.add': 'Ajouter',
  'contacts.skip': 'Passer',
  'contacts.continue': 'Continuer',

  'calibrate.title': 'Place chaque personne autour de toi',
  'calibrate.hint': 'Touche une personne, puis l’anneau qui lui correspond.',
  'calibrate.me': 'moi',
  'calibrate.listMode': 'Affichage en liste',
  'calibrate.empty': 'Tu pourras placer du monde plus tard, depuis ta carte.',
  'calibrate.optionalLayer': 'État · ressenti (optionnel)',
  'calibrate.optionalHint': 'Choisis d’abord une personne.',
  'calibrate.etatTitle': 'État',
  'calibrate.ressentiTitle': 'Ressenti',
  'calibrate.ringPrefix': 'Anneau',
  'calibrate.continue': 'Continuer',

  'ring.1': 'Très proche',
  'ring.2': 'Proche',
  'ring.3': 'Familier',
  'ring.4': 'Plus loin',

  'etat.available': 'disponible',
  'etat.busy': 'occupé',
  'etat.away': 'ailleurs',
  'ressenti.light': 'léger',
  'ressenti.precious': 'précieux',
  'ressenti.paused': 'en pause',

  'done.title': 'Voilà, c’est posé.',
  'done.subtitle': 'Ta carte est prête.',
  'done.promise': 'Personne — ni eux, ni nous — ne voit comment tu l’as remplie.',
  'done.cta': 'Voir ma carte',

  'carte.title': 'Ta carte',
  'carte.placeholder': 'La carte des relations arrive avec FS-02. Tes placements sont déjà là, chiffrés sur ton téléphone.',
} as const;

export type I18nKey = keyof typeof fr;

export function t(key: I18nKey): string {
  return fr[key];
}
