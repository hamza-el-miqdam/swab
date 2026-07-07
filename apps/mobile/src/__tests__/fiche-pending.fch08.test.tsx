/**
 * FCH-08 — a contact who hasn’t joined Swab yet (no linkedUserId) has a full
 * fiche: axes entirely editable, envie eligibility clearly shown as inactive
 * until they join. Once linked, the pending indication disappears.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ContactCard from '../../app/contact/[id]';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, getContacts, linkContact } from '../vault/vault';

let mockContactId = '';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockContactId }),
}));

beforeEach(() => {
  mockContactId = '';
  __resetVaultForTests();
});

describe('FCH-08 pending contact', () => {
  it('shows the pending indication and the inactive envie eligibility', async () => {
    const c = await addContact({ displayName: 'Yasmine' });
    mockContactId = c.id;
    render(<ContactCard />);

    expect(await screen.findByText(fr['fiche.pending'])).toBeTruthy();
    expect(screen.getByText(fr['fiche.envieInactive'])).toBeTruthy();
  });

  it('axes stay fully editable while pending', async () => {
    const c = await addContact({ displayName: 'Yasmine' });
    mockContactId = c.id;
    render(<ContactCard />);
    await screen.findByText('Yasmine');

    fireEvent.press(screen.getByLabelText(`${fr['fiche.ringTitle']} — ${fr['ring.3']}`));
    fireEvent.press(screen.getByLabelText(`${fr['fiche.rolesTitle']} — ${fr['role.colleague']}`));

    await waitFor(async () => {
      const stored = (await getContacts()).find((contact) => contact.id === c.id);
      expect(stored?.ring).toBe(3);
      expect(stored?.roles).toEqual([fr['role.colleague']]);
    });
  });

  it('once linked, the pending indication disappears', async () => {
    const c = await addContact({ displayName: 'Yasmine' });
    await linkContact(c.id, 'user-7');
    mockContactId = c.id;
    render(<ContactCard />);

    await screen.findByText('Yasmine');
    expect(screen.queryByText(fr['fiche.pending'])).toBeNull();
    expect(screen.queryByText(fr['fiche.envieInactive'])).toBeNull();
  });
});
