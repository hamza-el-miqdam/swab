/**
 * MAP-01 — the carte renders « moi » centered and every calibrated contact
 * on its declared ring, straight from the vault (no network — see MAP-05
 * scan). Unplaced contacts stay visible in a tray: nothing hidden silently.
 */
import { render, screen } from '@testing-library/react-native';

import Carte from '../../app/(main)/carte';
import { fr } from '../i18n/fr';
import { __resetVaultForTests, addContact, setRing } from '../vault/vault';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    usePathname: () => '/carte',
    useFocusEffect: (cb: () => void) => {
      // Focus-driven load: in tests the screen is always focused on mount.
      useEffect(cb, [cb]);
    },
  };
});

beforeEach(() => {
  __resetVaultForTests();
});

describe('MAP-01 radial map from the vault', () => {
  it('shows the header, « moi » at the center, and each contact on its ring', async () => {
    const lea = await addContact({ displayName: 'Léa' });
    const sami = await addContact({ displayName: 'Sami' });
    await setRing(lea.id, 1);
    await setRing(sami.id, 3);

    render(<Carte />);

    expect(await screen.findByLabelText(`Léa — ${fr['ring.1']}`)).toBeTruthy();
    expect(screen.getByLabelText(`Sami — ${fr['ring.3']}`)).toBeTruthy();
    expect(screen.getByText(fr['carte.me'])).toBeTruthy();
    expect(screen.getByText(fr['carte.title'])).toBeTruthy();
    expect(screen.getByText(fr['carte.subtitle'])).toBeTruthy();
  });

  it('keeps unplaced contacts visible in the tray (nothing hidden)', async () => {
    const placed = await addContact({ displayName: 'Léa' });
    await setRing(placed.id, 2);
    await addContact({ displayName: 'Nora' }); // never calibrated

    render(<Carte />);

    expect(await screen.findByLabelText(`Léa — ${fr['ring.2']}`)).toBeTruthy();
    expect(screen.getByLabelText('Nora')).toBeTruthy();
  });

  it('renders initials on the node, not the full name (glanceable, calm)', async () => {
    const lea = await addContact({ displayName: 'Léa Dupont' });
    await setRing(lea.id, 1);

    render(<Carte />);

    const node = await screen.findByLabelText(`Léa Dupont — ${fr['ring.1']}`);
    expect(node).toBeTruthy();
    expect(screen.getByText('LD')).toBeTruthy();
  });
});
