/**
 * MAP-09 / product law 5 — discovery is spatial only: no global search, no
 * sorting metrics, no "top friends". The carte renders no text input at
 * all, and its copy carries no ranking vocabulary.
 */
import { render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';

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

describe('MAP-09 spatial-only discovery', () => {
  it('the carte offers no search field or any text input', async () => {
    const lea = await addContact({ displayName: 'Léa' });
    await setRing(lea.id, 1);

    render(<Carte />);
    await screen.findByLabelText(`Léa — ${fr['ring.1']}`);

    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it('carte copy carries no ranking or metric vocabulary', () => {
    const carteCopy = Object.entries(fr)
      .filter(([key]) => key.startsWith('carte.') || key.startsWith('nav.'))
      .map(([, value]) => value)
      .join(' ');
    expect(carteCopy).not.toMatch(/top|classement|meilleur|score|tri(er)?\b/iu);
    expect(carteCopy).not.toMatch(/recherche/iu);
  });
});
