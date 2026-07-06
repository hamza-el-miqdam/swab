/**
 * MAP-08 — accessibility fallback: a screen-reader-navigable list grouped
 * by ring, feature-equivalent to the radial view. Every row announces
 * name + ring (TalkBack acceptance criterion).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import Carte from '../../app/(main)/carte';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, setRing } from '../vault/vault';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    usePathname: () => '/carte',
    useFocusEffect: (cb: () => void) => {
      useEffect(cb, [cb]);
    },
  };
});

beforeEach(() => {
  __resetVaultForTests();
});

async function seedAndOpenList(): Promise<void> {
  const lea = await addContact({ displayName: 'Léa' });
  const sami = await addContact({ displayName: 'Sami' });
  const nora = await addContact({ displayName: 'Nora' });
  await setRing(lea.id, 1);
  await setRing(sami.id, 1);
  await setRing(nora.id, 4);
  await addContact({ displayName: 'Yassine' }); // unplaced

  render(<Carte />);
  await screen.findByLabelText(`Léa — ${fr['ring.1']}`);
  fireEvent(screen.getByLabelText(fr['carte.listMode']), 'valueChange', true);
}

describe('MAP-08 list fallback', () => {
  it('groups contacts by ring with the ring vocabulary as section headers', async () => {
    await seedAndOpenList();

    expect(await screen.findByText(fr['ring.1'])).toBeTruthy();
    expect(screen.getByText(fr['ring.4'])).toBeTruthy();
    expect(screen.queryByText(fr['ring.2'])).toBeNull(); // empty rings stay silent
    expect(screen.getByText('Léa')).toBeTruthy();
    expect(screen.getByText('Sami')).toBeTruthy();
    expect(screen.getByText('Nora')).toBeTruthy();
    expect(screen.getByText('Yassine')).toBeTruthy(); // unplaced still listed
  });

  it('every row announces name + ring for assistive tech', async () => {
    await seedAndOpenList();

    expect(await screen.findByLabelText(`Léa — ${fr['ring.1']}`)).toBeTruthy();
    expect(screen.getByLabelText(`Sami — ${fr['ring.1']}`)).toBeTruthy();
    expect(screen.getByLabelText(`Nora — ${fr['ring.4']}`)).toBeTruthy();
    expect(screen.getByLabelText('Yassine')).toBeTruthy();
  });

  it('switching back returns to the radial map', async () => {
    await seedAndOpenList();
    fireEvent(screen.getByLabelText(fr['carte.listMode']), 'valueChange', false);
    expect(await screen.findByText(fr['carte.me'])).toBeTruthy();
  });
});
