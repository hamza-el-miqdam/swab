/**
 * ONB-03 — « Passer » keeps the flow completable, and an OS-level contacts
 * denial degrades gracefully to the manual path (FS-01 acceptance 2).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Contacts from 'expo-contacts';

import ContactsStep from '../../app/onboarding/contacts';
import { fr } from '../i18n/fr';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

describe('ONB-03 contacts step', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('« Passer » advances the flow with zero contacts and no nag', async () => {
    render(<ContactsStep />);
    fireEvent.press(screen.getByText(fr['contacts.skip']));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/calibrate'));
  });

  it('permission denial shows the calm fallback and keeps manual add available', async () => {
    (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    render(<ContactsStep />);
    fireEvent.press(screen.getByText(fr['contacts.import']));
    await waitFor(() => expect(screen.getByText(fr['contacts.denied'])).toBeTruthy());
    // manual path is intact
    expect(screen.getByPlaceholderText(fr['contacts.manualPlaceholder'])).toBeTruthy();
  });

  it('granted import lists device contacts; picking them fills the added line', async () => {
    (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    (Contacts.getContactsAsync as jest.Mock).mockResolvedValueOnce({
      data: [
        { name: 'Lina', phoneNumbers: [{ number: '+33 6 99 88 77 66' }] },
        { name: '', phoneNumbers: [] }, // nameless entries are filtered out
        { name: 'Yassine' }, // no number: added without a hash
      ],
    });
    render(<ContactsStep />);

    fireEvent.press(screen.getByText(fr['contacts.import']));
    fireEvent.press(await screen.findByText('Lina'));
    fireEvent.press(await screen.findByText('Yassine'));

    // both picked contacts appear in the added line, CTA becomes « Continuer »
    await waitFor(() => expect(screen.getByText('Lina · Yassine')).toBeTruthy());
    expect(screen.getByText(fr['contacts.continue'])).toBeTruthy();
    fireEvent.press(screen.getByText(fr['contacts.continue']));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/calibrate'));
  });

  it('manual add moves the CTA from « Passer » to « Continuer »', async () => {
    render(<ContactsStep />);
    fireEvent.changeText(
      screen.getByPlaceholderText(fr['contacts.manualPlaceholder']),
      'Sami',
    );
    fireEvent.press(screen.getByText(fr['contacts.add']));
    await waitFor(() => expect(screen.getByText(fr['contacts.continue'])).toBeTruthy());
  });
});
