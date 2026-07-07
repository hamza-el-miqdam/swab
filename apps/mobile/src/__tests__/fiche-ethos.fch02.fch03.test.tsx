/**
 * FCH-02 — classification is asymmetric and private: no fiche copy may imply
 * we know (or show) how the other person classified the user.
 * FCH-03 — « Aucun compteur, aucune métrique » : no counters, percentages,
 * scores, or celebration anywhere on the fiche. Mirrors the ONB-09
 * no-gamification pattern, extended for the fiche surface.
 */
import { render, screen } from '@testing-library/react-native';

import ContactCard from '../../app/contact/[id]';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, recordMatch, setEtat, setRing, setRoles } from '../vault/vault';

let mockContactId = '';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockContactId }),
}));

beforeEach(() => {
  mockContactId = '';
  __resetVaultForTests();
});

const FICHE_KEYS = Object.keys(fr).filter(
  (key) =>
    key.startsWith('fiche.') ||
    key.startsWith('role.') ||
    key === 'etat.paused' ||
    key === 'carte.fiches',
) as (keyof typeof fr)[];

// Same bans as ONB-09, plus digits (a fiche never needs a number in copy).
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\d/u, // no numerals at all in fiche copy (FCH-03)
  /félicitations|bravo|génial|super\s*!/iu,
  /match\s*!/iu,
  /🎉|🔥|⭐|🏆/u,
  /dépêche|vite|urgent|dernière chance/iu,
];

// FCH-02: nothing may read as "how they classified you back".
const SYMMETRY_PATTERNS: readonly RegExp[] = [
  /réciproc/iu,
  /mutuel/iu,
  /en retour/iu,
  /de son côté/iu,
  /te (classe|voit|place|considère)/iu,
  /t’a (classé|placé|mis)/iu,
];

describe('FCH-03 fiche copy stays calm and metric-free', () => {
  it.each(FICHE_KEYS)('%s carries no counter, metric, or celebration', (key) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(fr[key]).not.toMatch(pattern);
    }
  });
});

describe('FCH-02 fiche copy never implies symmetry', () => {
  it.each(FICHE_KEYS)('%s does not reflect the other person’s classification', (key) => {
    for (const pattern of SYMMETRY_PATTERNS) {
      expect(fr[key]).not.toMatch(pattern);
    }
  });
});

describe('FCH-03 the rendered fiche shows no counters or percentages', () => {
  it('a fully-filled fiche with history renders no "%", "x/y", or score-like text', async () => {
    const c = await addContact({ displayName: 'Nora' });
    await setRing(c.id, 1);
    await setRoles(c.id, [fr['role.friend']]);
    await setEtat(c.id, fr['etat.paused']);
    await recordMatch(c.id);
    mockContactId = c.id;

    render(<ContactCard />);
    await screen.findByText('Nora');

    expect(screen.queryAllByText(/\d+\s*%/u)).toHaveLength(0);
    expect(screen.queryAllByText(/\d+\s*\/\s*\d+/u)).toHaveLength(0);
    expect(screen.queryAllByText(/match\s*!/iu)).toHaveLength(0);
  });
});
