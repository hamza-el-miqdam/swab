/**
 * MAP-03 — état → node color. Blueprint palette mapped onto the SHIPPED
 * 3-état vocabulary (the blueprint's richer 5-état taxonomy is a flagged
 * divergence — see CHANGELOG; do not remap silently).
 */
import { t } from '../i18n/fr';
import { colors } from '../theme';

export const ETAT_COLORS: Readonly<Record<string, string>> = {
  [t('etat.available')]: '#8FB59A',
  [t('etat.busy')]: '#C8917E',
  [t('etat.away')]: '#8AA0BE',
};

export interface EtatColor {
  background: string;
  border: string;
}

export function etatColor(etat: string | undefined): EtatColor {
  const background = etat !== undefined ? ETAT_COLORS[etat] : undefined;
  if (background === undefined) {
    return { background: colors.surface, border: colors.line };
  }
  return { background, border: background };
}
