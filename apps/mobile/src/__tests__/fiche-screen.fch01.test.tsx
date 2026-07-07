/**
 * FCH-01 — the four axes are tap-editable on the fiche; every edit lands in
 * the vault and appends a history event. FCH-04 — the feed renders from the
 * vault, newest first, 12-month window. FCH-07 — back navigation (interim
 * router.back(); the MAP-04 spatial transition lands with FS-02). Plus the
 * interim entry point on the carte placeholder.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ContactCard from '../../app/contact/[id]';
import Index from '../../app/index';
import { DAY_MS } from '../domain/fiche';
import { fr } from '../i18n/fr';
import { setStep } from '../onboarding/state';
import { __resetVaultForTests, addContact, getContacts, setEtat } from '../vault/vault';

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockContactId = '';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
    useLocalSearchParams: () => ({ id: mockContactId }),
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});

beforeEach(() => {
  mockBack.mockReset();
  mockPush.mockReset();
  mockContactId = '';
  __resetVaultForTests();
});

async function seed(displayName = 'Nora'): Promise<string> {
  const c = await addContact({ displayName });
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

describe('FCH-01 tap-editable axes write the vault + history', () => {
  it('renders the contact and its four axis sections', async () => {
    await seed('Nora');
    render(<ContactCard />);
    expect(await screen.findByText('Nora')).toBeTruthy();
    expect(screen.getByText(fr['fiche.ringTitle'])).toBeTruthy();
    expect(screen.getByText(fr['fiche.rolesTitle'])).toBeTruthy();
    expect(screen.getByText(fr['fiche.etatTitle'])).toBeTruthy();
    expect(screen.getByText(fr['fiche.ressentiTitle'])).toBeTruthy();
  });

  it('tap a ring → vault write + axis-change history event', async () => {
    const id = await seed();
    render(<ContactCard />);
    await screen.findByText('Nora');

    fireEvent.press(screen.getByLabelText(`${fr['fiche.ringTitle']} — ${fr['ring.2']}`));

    await waitFor(async () => {
      const stored = await vaultContact(id);
      expect(stored.ring).toBe(2);
      expect(stored.history).toHaveLength(1);
      expect(stored.history[0]).toMatchObject({ kind: 'axis-change', axis: 'ring', value: '2' });
    });
  });

  it('roles are multi-select: tap adds, tap again removes — each tap is an event', async () => {
    const id = await seed();
    render(<ContactCard />);
    await screen.findByText('Nora');

    const label = `${fr['fiche.rolesTitle']} — ${fr['role.friend']}`;
    fireEvent.press(screen.getByLabelText(label));
    await waitFor(async () =>
      expect((await vaultContact(id)).roles).toEqual([fr['role.friend']]),
    );

    fireEvent.press(screen.getByLabelText(`${fr['fiche.rolesTitle']} — ${fr['role.family']}`));
    await waitFor(async () =>
      expect((await vaultContact(id)).roles).toEqual([fr['role.friend'], fr['role.family']]),
    );

    fireEvent.press(screen.getByLabelText(label));
    await waitFor(async () => {
      const stored = await vaultContact(id);
      expect(stored.roles).toEqual([fr['role.family']]);
      expect(stored.history).toHaveLength(3);
    });
  });

  it('tap état / ressenti → vault write; tapping the current value clears it', async () => {
    const id = await seed();
    render(<ContactCard />);
    await screen.findByText('Nora');

    fireEvent.press(screen.getByLabelText(`${fr['fiche.etatTitle']} — ${fr['etat.busy']}`));
    await waitFor(async () => expect((await vaultContact(id)).etat).toBe(fr['etat.busy']));

    fireEvent.press(
      screen.getByLabelText(`${fr['fiche.ressentiTitle']} — ${fr['ressenti.precious']}`),
    );
    await waitFor(async () =>
      expect((await vaultContact(id)).ressenti).toBe(fr['ressenti.precious']),
    );

    fireEvent.press(screen.getByLabelText(`${fr['fiche.etatTitle']} — ${fr['etat.busy']}`));
    await waitFor(async () => expect((await vaultContact(id)).etat).toBeUndefined());
  });
});

describe('FCH-04 history feed', () => {
  it('renders vault history newest first and hides events older than 12 months', async () => {
    const past = Date.now() - 400 * DAY_MS;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(past);
    const id = await seed();
    await setEtat(id, fr['etat.away']); // 400 days ago — outside the window
    spy.mockRestore();

    await setEtat(id, fr['etat.available']);
    await setEtat(id, fr['etat.busy']);

    render(<ContactCard />);
    await screen.findByText('Nora');

    expect(screen.queryByText(`${fr['fiche.etatTitle']} — ${fr['etat.away']}`)).toBeNull();
    const rows = screen.getAllByText(new RegExp(`^${fr['fiche.etatTitle']} — `, 'u'));
    expect(rows.map((r) => r.props.children)).toEqual([
      `${fr['fiche.etatTitle']} — ${fr['etat.busy']}`,
      `${fr['fiche.etatTitle']} — ${fr['etat.available']}`,
    ]);
  });

  it('shows the calm empty line when nothing moved in 12 months', async () => {
    await seed();
    render(<ContactCard />);
    expect(await screen.findByText(fr['fiche.historyEmpty'])).toBeTruthy();
  });
});

describe('FCH-07 back navigation (MAP-04 transition deferred to FS-02)', () => {
  it('the back control calls router.back()', async () => {
    await seed();
    render(<ContactCard />);
    await screen.findByText('Nora');

    fireEvent.press(screen.getByLabelText(fr['fiche.back']));
    expect(mockBack).toHaveBeenCalled();
  });

  it('an unknown id shows the calm not-found state with a way back', async () => {
    mockContactId = 'no-such-id';
    render(<ContactCard />);
    expect(await screen.findByText(fr['fiche.notFound'])).toBeTruthy();
    fireEvent.press(screen.getByLabelText(fr['fiche.back']));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('interim entry point on the carte placeholder', () => {
  it('lists contacts plainly and opens the fiche on tap', async () => {
    await setStep('complete');
    const id = await seed('Sami');
    render(<Index />);

    expect(await screen.findByText(fr['carte.fiches'])).toBeTruthy();
    fireEvent.press(screen.getByText('Sami'));
    expect(mockPush).toHaveBeenCalledWith(`/contact/${id}`);
  });

  it('shows no list heading when there are no contacts', async () => {
    await setStep('complete');
    render(<Index />);
    expect(await screen.findByText(fr['carte.title'])).toBeTruthy();
    expect(screen.queryByText(fr['carte.fiches'])).toBeNull();
  });
});
