/**
 * MAP-06 — a nearly-empty map is calm: the approved invitation copy, no
 * alarm, no progress framing, and the header stays identical to a full map.
 */
import { render, screen } from '@testing-library/react-native';

import Carte from '../../app/(main)/carte';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact } from '../vault/vault';

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

describe('MAP-06 calm empty state', () => {
  it('an empty vault shows the invitation, « moi », and no alarm framing', async () => {
    render(<Carte />);
    expect(await screen.findByText(fr['carte.empty'])).toBeTruthy();
    expect(screen.getByText(fr['carte.me'])).toBeTruthy(); // you are still on your map
    expect(screen.getByText(fr['carte.title'])).toBeTruthy();
    expect(fr['carte.empty']).not.toMatch(/\d|!|encore|seulement/iu);
  });

  it('the invitation disappears as soon as anyone exists (even unplaced)', async () => {
    await addContact({ displayName: 'Nora' });
    render(<Carte />);
    expect(await screen.findByLabelText('Nora')).toBeTruthy();
    expect(screen.queryByText(fr['carte.empty'])).toBeNull();
  });
});
