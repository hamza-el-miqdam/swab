/**
 * Axis vocabularies — data-driven, single source for calibration (FS-01) and
 * the fiche (FS-03). OQ-FCH-1: rôles·contexte and ressenti are PLACEHOLDER
 * taxonomies until the Architect extracts the real ones with Hamza.
 *
 * FCH-06: état includes the blueprint-attested « en pause », and each état
 * value can declare its FS-06 filter consequence here — the mechanism is
 * per-value so future consequences plug in without touching components.
 */
import { t, type I18nKey } from '../i18n/fr';
import type { IntimacyRing } from '../vault/vault';

export const RINGS: readonly IntimacyRing[] = [1, 2, 3, 4];

export const RING_LABEL: Readonly<Record<IntimacyRing, string>> = {
  1: t('ring.1'),
  2: t('ring.2'),
  3: t('ring.3'),
  4: t('ring.4'),
};

export const ETATS: readonly string[] = [
  t('etat.available'),
  t('etat.busy'),
  t('etat.away'),
  t('etat.paused'),
];

export const RESSENTIS: readonly string[] = [
  t('ressenti.light'),
  t('ressenti.precious'),
  t('ressenti.paused'),
];

/** OQ-FCH-1 placeholder rôles·contexte list. */
export const ROLES: readonly string[] = [
  t('role.friend'),
  t('role.family'),
  t('role.colleague'),
  t('role.neighbor'),
];

/** FCH-06: état value → i18n key of its FS-06 consequence line. */
export const ETAT_CONSEQUENCE: Readonly<Partial<Record<string, I18nKey>>> = {
  [t('etat.paused')]: 'fiche.consequence.paused',
};
