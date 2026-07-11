/**
 * MAP-04 — tap a contact → peek sheet with Intimité / État / Rôles and
 * « Ouvrir la fiche ». The fiche button is the FS-03 seam: rendered but
 * disabled until the fiche exists — visible, honest, not hidden. The list
 * fallback opens the exact same sheet (MAP-08 feature equivalence).
 */
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import Carte from '../../app/(main)/carte';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, setEtat, setRing } from '../vault/vault';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    usePathname: () => '/carte',
    useFocusEffect: (cb: () => void) => {
      useEffect(cb, [cb]);
    },
  };
});

beforeEach(() => {
  mockPush.mockReset();
  __resetVaultForTests();
});

async function seed(): Promise<void> {
  const lea = await addContact({ displayName: 'Léa' });
  await setRing(lea.id, 1);
  await setEtat(lea.id, fr['etat.busy']);
}

describe('MAP-04 peek sheet', () => {
  it('opens on node tap with Intimité / État / Rôles and the contact name', async () => {
    await seed();
    render(<Carte />);

    fireEvent.press(await screen.findByLabelText(`Léa — ${fr['ring.1']}`));

    const sheet = within(screen.getByTestId('peek-sheet'));
    expect(sheet.getByText('Léa')).toBeTruthy();
    expect(sheet.getByText(fr['carte.sheet.intimite'])).toBeTruthy();
    expect(sheet.getByText(fr['ring.1'])).toBeTruthy();
    expect(sheet.getByText(fr['carte.sheet.etat'])).toBeTruthy();
    expect(sheet.getByText(fr['etat.busy'])).toBeTruthy();
    expect(sheet.getByText(fr['carte.sheet.roles'])).toBeTruthy();
  });

  it('« Ouvrir la fiche » is present but disabled — the FS-03 seam', async () => {
    await seed();
    render(<Carte />);

    fireEvent.press(await screen.findByLabelText(`Léa — ${fr['ring.1']}`));

    const openFiche = screen.getByLabelText(fr['carte.openFiche']);
    expect(openFiche.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(openFiche);
    expect(mockPush).not.toHaveBeenCalled(); // no navigation until FS-03
  });

  it('tapping the scrim closes the sheet', async () => {
    await seed();
    render(<Carte />);

    fireEvent.press(await screen.findByLabelText(`Léa — ${fr['ring.1']}`));
    expect(screen.getByTestId('peek-sheet')).toBeTruthy();

    fireEvent.press(screen.getByTestId('peek-scrim'));
    expect(screen.queryByTestId('peek-sheet')).toBeNull();
  });

  it('a list row opens the same sheet (MAP-08 feature equivalence)', async () => {
    await seed();
    render(<Carte />);
    await screen.findByLabelText(`Léa — ${fr['ring.1']}`);

    fireEvent(screen.getByLabelText(fr['carte.listMode']), 'valueChange', true);
    fireEvent.press(await screen.findByLabelText(`Léa — ${fr['ring.1']}`));

    const sheet = within(screen.getByTestId('peek-sheet'));
    expect(sheet.getByText(fr['carte.sheet.intimite'])).toBeTruthy();
    expect(sheet.getByText(fr['carte.openFiche'])).toBeTruthy();
  });

  it('an unplaced tray contact opens the sheet with a calm placeholder intimité', async () => {
    await addContact({ displayName: 'Nora' });
    render(<Carte />);

    fireEvent.press(await screen.findByLabelText('Nora'));

    const sheet = within(screen.getByTestId('peek-sheet'));
    expect(sheet.getByText('Nora')).toBeTruthy();
    expect(sheet.getByText(fr['carte.sheet.intimite'])).toBeTruthy();
    expect(sheet.getAllByText('—')).toHaveLength(3); // all axes unset → quiet dashes
  });
});
