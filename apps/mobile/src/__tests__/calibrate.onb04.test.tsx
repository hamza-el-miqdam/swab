/**
 * ONB-04/05/06 — radial calibration: select a person, tap a ring; the list
 * mode offers the same capabilities (accessibility); the optional layer
 * (état · ressenti) is collapsed by default and never blocking. Everything
 * written lands in the vault only — asserted via the vault API itself.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Calibrate from '../../app/onboarding/calibrate';
import { fr } from '../i18n/fr';
import { getStep } from '../onboarding/state';
import { __resetVaultForTests, addContact, getContacts } from '../vault/vault';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

beforeEach(() => {
  mockPush.mockReset();
  __resetVaultForTests();
});

describe('ONB-04 calibration', () => {
  it('shows the calm empty state when nobody is added yet', async () => {
    render(<Calibrate />);
    expect(await screen.findByText(fr['calibrate.empty'])).toBeTruthy();
  });

  it('tap a person, tap a ring: the placement lands in the vault (ONB-05)', async () => {
    const sami = await addContact({ displayName: 'Sami' });
    await addContact({ displayName: 'Nora' });
    render(<Calibrate />);

    fireEvent.press(await screen.findByText('Sami'));
    fireEvent.press(
      screen.getByLabelText(`${fr['calibrate.ringPrefix']} 1 — ${fr['ring.1']}`),
    );

    await waitFor(() =>
      expect(screen.getByLabelText(`Sami — ${fr['ring.1']}`)).toBeTruthy(),
    );
    const contacts = await getContacts();
    expect(contacts.find((c) => c.id === sami.id)?.ring).toBe(1);
    // Nora is still unplaced, in the tray
    expect(contacts.find((c) => c.displayName === 'Nora')?.ring).toBeUndefined();
  });

  it('ring buttons are inert until a person is selected (no accidental writes)', async () => {
    const sami = await addContact({ displayName: 'Sami' });
    render(<Calibrate />);
    await screen.findByText('Sami');

    fireEvent.press(
      screen.getByLabelText(`${fr['calibrate.ringPrefix']} 2 — ${fr['ring.2']}`),
    );

    const contacts = await getContacts();
    expect(contacts.find((c) => c.id === sami.id)?.ring).toBeUndefined();
  });

  it('list mode offers the same placement capability (accessibility)', async () => {
    const nora = await addContact({ displayName: 'Nora' });
    render(<Calibrate />);
    await screen.findByText('Nora');

    fireEvent(screen.getByLabelText(fr['calibrate.listMode']), 'valueChange', true);
    fireEvent.press(await screen.findByText('Nora'));
    fireEvent.press(
      screen.getByLabelText(`${fr['calibrate.ringPrefix']} 3 — ${fr['ring.3']}`),
    );

    await waitFor(() =>
      expect(screen.getByLabelText(`Nora — ${fr['ring.3']}`)).toBeTruthy(),
    );
    const contacts = await getContacts();
    expect(contacts.find((c) => c.id === nora.id)?.ring).toBe(3);
  });

  it('the optional layer is collapsed by default and hints when nobody is selected (ONB-06)', async () => {
    await addContact({ displayName: 'Sami' });
    render(<Calibrate />);
    await screen.findByText('Sami');

    expect(screen.queryByText(fr['calibrate.etatTitle'])).toBeNull();
    fireEvent.press(screen.getByText(fr['calibrate.optionalLayer']));
    expect(await screen.findByText(fr['calibrate.optionalHint'])).toBeTruthy();
  });

  it('état and ressenti go to the vault for the selected person (ONB-06)', async () => {
    const sami = await addContact({ displayName: 'Sami' });
    render(<Calibrate />);

    fireEvent.press(await screen.findByText('Sami'));
    fireEvent.press(screen.getByText(fr['calibrate.optionalLayer']));
    fireEvent.press(await screen.findByText(fr['etat.available']));
    await waitFor(async () =>
      expect((await getContacts()).find((c) => c.id === sami.id)?.etat).toBe(
        fr['etat.available'],
      ),
    );

    fireEvent.press(screen.getByText(fr['ressenti.precious']));
    await waitFor(async () =>
      expect((await getContacts()).find((c) => c.id === sami.id)?.ressenti).toBe(
        fr['ressenti.precious'],
      ),
    );
  });

  it('« Continuer » advances to done', async () => {
    render(<Calibrate />);
    fireEvent.press(screen.getByText(fr['calibrate.continue']));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/done'));
    await expect(getStep()).resolves.toBe('done');
  });
});
