/**
 * ONB-02 (first half) / IDT-01 — phone entry: the raw number is hashed in
 * the input handler; only the hash reaches the API. Errors stay calm and
 * the flow moves to OTP on success.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createHash } from 'node:crypto';

import Phone from '../../app/onboarding/phone';
import { requestOtp } from '../api/client';
import { fr } from '../i18n/fr';
import { clearPendingPhoneHash, getDevCode, getPendingPhoneHash } from '../onboarding/signup';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  requestOtp: jest.fn(),
}));
const requestOtpMock = requestOtp as jest.Mock;

const RAW = '+33 6 12 34 56 78';
const EXPECTED_HASH = createHash('sha256')
  .update('swab-poc-phone-salt-v1:+33612345678')
  .digest('hex');

beforeEach(() => {
  mockPush.mockReset();
  requestOtpMock.mockReset();
  clearPendingPhoneHash();
});

describe('ONB-02 phone screen', () => {
  it('sends only the on-device hash — never the raw number (IDT-01)', async () => {
    requestOtpMock.mockResolvedValue({ devCode: '123456' });
    render(<Phone />);

    fireEvent.changeText(screen.getByPlaceholderText(fr['phone.placeholder']), RAW);
    fireEvent.press(screen.getByText(fr['phone.cta']));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/otp'));
    expect(requestOtpMock).toHaveBeenCalledWith({ phoneHash: EXPECTED_HASH });
    expect(JSON.stringify(requestOtpMock.mock.calls)).not.toContain('0612345678');
    expect(getPendingPhoneHash()).toBe(EXPECTED_HASH);
    expect(getDevCode()).toBe('123456');
  });

  it('keeps the CTA disabled until a plausible number is typed', () => {
    render(<Phone />);
    fireEvent.press(screen.getByText(fr['phone.cta']));
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it('shows the calm error copy when the request fails, and recovers', async () => {
    requestOtpMock.mockRejectedValueOnce(new Error('network'));
    render(<Phone />);

    fireEvent.changeText(screen.getByPlaceholderText(fr['phone.placeholder']), RAW);
    fireEvent.press(screen.getByText(fr['phone.cta']));

    await waitFor(() => expect(screen.getByText(fr['phone.error'])).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
