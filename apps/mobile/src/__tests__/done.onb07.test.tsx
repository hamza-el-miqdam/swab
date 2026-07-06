/**
 * ONB-07 — completion: the promise restated, sync attempted best-effort,
 * and OFFLINE COMPLETION IS FIRST-CLASS (FS-01 acceptance 1): a failing
 * sync must not block finishing.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Done from '../../app/onboarding/done';
import { fr } from '../i18n/fr';
import { getStep } from '../onboarding/state';
import { syncVault } from '../vault/sync';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

jest.mock('../vault/sync', () => ({
  syncVault: jest.fn(),
}));
const syncMock = syncVault as jest.Mock;

beforeEach(() => {
  mockReplace.mockReset();
  syncMock.mockReset();
});

describe('ONB-07 done screen', () => {
  it('restates the privacy promise at the moment it became true', () => {
    syncMock.mockResolvedValue(undefined);
    render(<Done />);
    expect(screen.getByText(fr['done.promise'])).toBeTruthy();
    expect(screen.getByText(fr['done.title'])).toBeTruthy();
  });

  it('completes and routes home even when sync fails (offline first-class)', async () => {
    syncMock.mockRejectedValue(new Error('offline'));
    render(<Done />);

    fireEvent.press(screen.getByText(fr['done.cta']));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(syncMock).toHaveBeenCalled();
    await expect(getStep()).resolves.toBe('complete');
  });
});
