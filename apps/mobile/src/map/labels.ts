/**
 * Shared accessibility vocabulary for the carte (MAP-08 acceptance:
 * every contact announces name + ring, identically in map and list).
 */
import { t } from '../i18n/fr';
import type { IntimacyRing, VaultContact } from '../vault/vault';

export const RING_LABEL: Readonly<Record<IntimacyRing, string>> = {
  1: t('ring.1'),
  2: t('ring.2'),
  3: t('ring.3'),
  4: t('ring.4'),
};

/** « Léa — Très proche » for placed contacts, plain name otherwise. */
export function contactLabel(contact: VaultContact): string {
  return contact.ring !== undefined
    ? `${contact.displayName} — ${RING_LABEL[contact.ring]}`
    : contact.displayName;
}

/** Up to two initials — glanceable node content, never the full name. */
export function initials(displayName: string): string {
  return displayName
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr') ?? '')
    .join('');
}
