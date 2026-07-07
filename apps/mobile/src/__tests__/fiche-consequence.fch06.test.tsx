/**
 * FCH-06 — état includes the blueprint-attested « en pause », and the fiche
 * shows the FS-06 filter consequence for the current état so filtering stays
 * legible (« en pause → exclu par défaut à l’envoi »). The mechanism is
 * per-état-value (data-driven) so other consequences can plug in later.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ContactCard from '../../app/contact/[id]';
import { ETATS, ETAT_CONSEQUENCE } from '../domain/taxonomies';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, getContacts } from '../vault/vault';

let mockContactId = '';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockContactId }),
}));

beforeEach(() => {
  mockContactId = '';
  __resetVaultForTests();
});

describe('FCH-06 état « en pause » and its filter consequence', () => {
  it('the état vocabulary includes « en pause » (data-driven, not hardcoded)', () => {
    expect(fr['etat.paused']).toBe('en pause');
    expect(ETATS).toContain(fr['etat.paused']);
    expect(ETAT_CONSEQUENCE[fr['etat.paused']]).toBe('fiche.consequence.paused');
  });

  it('selecting « en pause » shows the FS-06 consequence line', async () => {
    const c = await addContact({ displayName: 'Théo' });
    mockContactId = c.id;
    render(<ContactCard />);
    await screen.findByText('Théo');

    expect(screen.queryByText(fr['fiche.consequence.paused'])).toBeNull();
    fireEvent.press(screen.getByLabelText(`${fr['fiche.etatTitle']} — ${fr['etat.paused']}`));

    expect(await screen.findByText(fr['fiche.consequence.paused'])).toBeTruthy();
    const stored = (await getContacts()).find((contact) => contact.id === c.id);
    expect(stored?.etat).toBe(fr['etat.paused']);
  });

  it('an état without a consequence shows no consequence line', async () => {
    const c = await addContact({ displayName: 'Théo' });
    mockContactId = c.id;
    render(<ContactCard />);
    await screen.findByText('Théo');

    fireEvent.press(screen.getByLabelText(`${fr['fiche.etatTitle']} — ${fr['etat.available']}`));
    await waitFor(async () => {
      const stored = (await getContacts()).find((contact) => contact.id === c.id);
      expect(stored?.etat).toBe(fr['etat.available']);
    });
    expect(screen.queryByText(fr['fiche.consequence.paused'])).toBeNull();
  });

  it('état « en pause » is distinct from ressenti « en pause » on the fiche', async () => {
    const c = await addContact({ displayName: 'Théo' });
    mockContactId = c.id;
    render(<ContactCard />);
    await screen.findByText('Théo');

    expect(screen.getByLabelText(`${fr['fiche.etatTitle']} — ${fr['etat.paused']}`)).toBeTruthy();
    expect(
      screen.getByLabelText(`${fr['fiche.ressentiTitle']} — ${fr['ressenti.paused']}`),
    ).toBeTruthy();
  });
});
