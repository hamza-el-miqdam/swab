/**
 * ONB-09 / product law 5 — calm by design, enforced on the copy itself:
 * no percentages, counters, celebrations, or urgency in any UI string.
 */
import { fr } from '../i18n/fr';

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\d+\s*%/u, // progress percentages
  /\d+\s*\/\s*\d+/u, // step counters "2/5"
  /félicitations|bravo|génial|super\s*!/iu, // celebration
  /match\s*!/iu, // the blueprint explicitly bans « match ! »
  /🎉|🔥|⭐|🏆/u, // celebration emoji
  /dépêche|vite|urgent|dernière chance/iu, // urgency
];

describe('ONB-09 no gamification in UI copy', () => {
  it.each(Object.entries(fr))('%s stays calm', (_key, value) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(value).not.toMatch(pattern);
    }
  });
});
