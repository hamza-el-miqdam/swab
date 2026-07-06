/**
 * MAP-03 — the node encodes the axes non-textually: ring = intimité
 * (distance), état = node color. The color mapping is the FS-02 visual
 * grammar (blueprint palette on the shipped 3-état vocabulary), and the
 * légende explains it on demand.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import Carte from '../../app/(main)/carte';
import { fr } from '../i18n/fr';
import { ETAT_COLORS, etatColor } from '../map/etatColors';
import { colors } from '../theme';
import { __resetVaultForTests, addContact, setEtat, setRing } from '../vault/vault';

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

function backgroundOf(label: string): unknown {
  const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
  return (style as { backgroundColor?: unknown }).backgroundColor;
}

describe('MAP-03 état → color mapping (pure)', () => {
  it.each([
    [fr['etat.available'], '#8FB59A'],
    [fr['etat.busy'], '#C8917E'],
    [fr['etat.away'], '#8AA0BE'],
  ])('%s maps to %s', (etat, hex) => {
    expect(etatColor(etat).background).toBe(hex);
  });

  it('unset état falls back to the neutral surface', () => {
    expect(etatColor(undefined)).toEqual({
      background: colors.surface,
      border: colors.line,
    });
  });

  it('covers exactly the shipped état vocabulary', () => {
    expect(Object.keys(ETAT_COLORS).sort()).toEqual(
      [fr['etat.available'], fr['etat.busy'], fr['etat.away']].sort(),
    );
  });
});

describe('MAP-03 état on the rendered node', () => {
  it('colors the node background by état', async () => {
    const lea = await addContact({ displayName: 'Léa' });
    await setRing(lea.id, 1);
    await setEtat(lea.id, fr['etat.available']);
    const sami = await addContact({ displayName: 'Sami' });
    await setRing(sami.id, 2);

    render(<Carte />);
    await screen.findByLabelText(`Léa — ${fr['ring.1']}`);

    expect(backgroundOf(`Léa — ${fr['ring.1']}`)).toBe('#8FB59A');
    expect(backgroundOf(`Sami — ${fr['ring.2']}`)).toBe(colors.surface);
  });

  it('the légende explains each état color on demand', async () => {
    const lea = await addContact({ displayName: 'Léa' });
    await setRing(lea.id, 1);
    render(<Carte />);
    await screen.findByLabelText(`Léa — ${fr['ring.1']}`);

    expect(screen.queryByText(fr['etat.available'])).toBeNull(); // collapsed by default
    fireEvent.press(screen.getByText(fr['carte.legend']));
    expect(screen.getByText(fr['etat.available'])).toBeTruthy();
    expect(screen.getByText(fr['etat.busy'])).toBeTruthy();
    expect(screen.getByText(fr['etat.away'])).toBeTruthy();
  });
});
