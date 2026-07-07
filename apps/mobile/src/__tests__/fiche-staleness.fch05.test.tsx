/**
 * FCH-05 — the re-tag invitation is discreet: inline (never a modal, never
 * blocking), exactly two actions. « C’est toujours ça » re-confirms and
 * resets the timer; « À revoir plus tard » dismisses quietly for 30 days.
 * Nothing is ever sent server-side.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ContactCard from '../../app/contact/[id]';
import { DAY_MS } from '../domain/fiche';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, getContacts, setRing, snoozeRetag } from '../vault/vault';

const mockBack = jest.fn();
let mockContactId = '';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockContactId }),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  mockBack.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  mockContactId = '';
  __resetVaultForTests();
});

/** Seeds a contact whose last axis activity is `daysAgo` in the past. */
async function seedAged(daysAgo: number): Promise<string> {
  const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - daysAgo * DAY_MS);
  const c = await addContact({ displayName: 'Sami' });
  await setRing(c.id, 2);
  spy.mockRestore();
  mockContactId = c.id;
  return c.id;
}

async function vaultContact(id: string) {
  const stored = (await getContacts()).find((c) => c.id === id);
  if (stored === undefined) {
    throw new Error('contact not in vault');
  }
  return stored;
}

describe('FCH-05 staleness nudge', () => {
  it('stays absent while the tags are fresh', async () => {
    const c = await addContact({ displayName: 'Sami' });
    await setRing(c.id, 2);
    mockContactId = c.id;

    render(<ContactCard />);
    await screen.findByText('Sami');
    expect(screen.queryByText(fr['fiche.retag.prompt'])).toBeNull();
  });

  it('appears inline after the quiet period, with exactly two actions, never blocking', async () => {
    await seedAged(210);
    render(<ContactCard />);

    expect(await screen.findByText(fr['fiche.retag.prompt'])).toBeTruthy();
    expect(screen.getByLabelText(fr['fiche.retag.confirm'])).toBeTruthy();
    expect(screen.getByLabelText(fr['fiche.retag.later'])).toBeTruthy();

    // Not a modal: the axes stay reachable and editable while the nudge shows.
    const ringChip = screen.getByLabelText(`${fr['fiche.ringTitle']} — ${fr['ring.1']}`);
    fireEvent.press(ringChip);
    await waitFor(async () =>
      expect((await vaultContact(mockContactId)).ring).toBe(1),
    );
  });

  it('« C’est toujours ça » appends a reconfirm event and hides the nudge', async () => {
    const id = await seedAged(210);
    render(<ContactCard />);
    await screen.findByText(fr['fiche.retag.prompt']);

    fireEvent.press(screen.getByLabelText(fr['fiche.retag.confirm']));

    await waitFor(() => expect(screen.queryByText(fr['fiche.retag.prompt'])).toBeNull());
    const stored = await vaultContact(id);
    expect(stored.history.some((e) => e.kind === 'reconfirm')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); // nothing server-side
  });

  it('« À revoir plus tard » dismisses quietly — snooze stored, no event, no network', async () => {
    const id = await seedAged(210);
    render(<ContactCard />);
    await screen.findByText(fr['fiche.retag.prompt']);

    fireEvent.press(screen.getByLabelText(fr['fiche.retag.later']));

    await waitFor(() => expect(screen.queryByText(fr['fiche.retag.prompt'])).toBeNull());
    const stored = await vaultContact(id);
    expect(typeof stored.retagSnoozedAt).toBe('number');
    expect(stored.history.some((e) => e.kind === 'reconfirm')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a snooze older than 30 days makes the nudge eligible again', async () => {
    const id = await seedAged(210);
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 31 * DAY_MS);
    await snoozeRetag(id);
    spy.mockRestore();

    render(<ContactCard />);
    expect(await screen.findByText(fr['fiche.retag.prompt'])).toBeTruthy();
  });
});
