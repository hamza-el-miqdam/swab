/**
 * ONB-02 (second half) — OTP verification: session stored and vault key
 * created BEFORE any classification input; 422 reveals the name field and
 * retries with the same code; a lost pending hash offers the way back.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Otp from '../../app/onboarding/otp';
import { ApiError, verifyOtp } from '../api/client';
import { fr } from '../i18n/fr';
import { getAccessToken } from '../lib/session';
import { clearPendingPhoneHash, setDevCode, setPendingPhoneHash } from '../onboarding/signup';
import { getStep } from '../onboarding/state';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  verifyOtp: jest.fn(),
}));
const verifyOtpMock = verifyOtp as jest.Mock;

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  verifyOtpMock.mockReset();
  clearPendingPhoneHash();
});

describe('ONB-02 OTP screen', () => {
  it('offers the way back to the phone step when the pending hash is gone (ONB-08)', () => {
    render(<Otp />);
    expect(screen.getByText(fr['otp.missingPhone'])).toBeTruthy();
    fireEvent.press(screen.getByText(fr['otp.backToPhone']));
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/phone');
  });

  it('on success: stores the session, creates the vault key, advances to contacts', async () => {
    setPendingPhoneHash('hash-1');
    setDevCode('123456');
    verifyOtpMock.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1' });
    render(<Otp />);

    expect(screen.getByText('Code (dev) : 123456')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText(fr['otp.placeholder']), '123456');
    fireEvent.press(screen.getByText(fr['otp.cta']));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/contacts'));
    expect(verifyOtpMock).toHaveBeenCalledWith({ phoneHash: 'hash-1', code: '123456' });
    await expect(getAccessToken()).resolves.toBe('a1'); // session in keychain (IDT-02)
    await expect(getStep()).resolves.toBe('contacts');
  });

  it('reveals the name field on 422 and retries with the same code', async () => {
    setPendingPhoneHash('hash-1');
    verifyOtpMock
      .mockRejectedValueOnce(new ApiError(422, 'displayName required'))
      .mockResolvedValueOnce({ accessToken: 'a2', refreshToken: 'r2' });
    render(<Otp />);

    fireEvent.changeText(screen.getByPlaceholderText(fr['otp.placeholder']), '654321');
    fireEvent.press(screen.getByText(fr['otp.cta']));

    const nameField = await screen.findByPlaceholderText(fr['otp.namePrompt']);
    fireEvent.changeText(nameField, 'Sami');
    fireEvent.press(screen.getByText(fr['otp.cta']));

    await waitFor(() =>
      expect(verifyOtpMock).toHaveBeenLastCalledWith({
        phoneHash: 'hash-1',
        code: '654321',
        displayName: 'Sami',
      }),
    );
  });

  it('shows the calm error copy on a wrong code', async () => {
    setPendingPhoneHash('hash-1');
    verifyOtpMock.mockRejectedValueOnce(new ApiError(401, 'bad code'));
    render(<Otp />);

    fireEvent.changeText(screen.getByPlaceholderText(fr['otp.placeholder']), '000000');
    fireEvent.press(screen.getByText(fr['otp.cta']));

    await waitFor(() => expect(screen.getByText(fr['otp.error'])).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
