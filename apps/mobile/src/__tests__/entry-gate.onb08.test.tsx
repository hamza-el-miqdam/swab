/**
 * ONB-08 — the entry gate resumes at the persisted step; once complete it
 * redirects home to the carte (FS-02). Plus: the welcome CTA actually
 * starts the flow (ONB-01), and the root layout renders.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import RootLayout from '../../app/_layout';
import Index from '../../app/index';
import Welcome from '../../app/onboarding/welcome';
import { fr } from '../i18n/fr';
import { getStep, setStep } from '../onboarding/state';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack: () => null,
  };
});

beforeEach(() => {
  mockPush.mockReset();
});

describe('ONB-08 entry gate', () => {
  it('redirects to the persisted step mid-flow', async () => {
    await setStep('calibrate');
    render(<Index />);
    expect(await screen.findByText('redirect:/onboarding/calibrate')).toBeTruthy();
  });

  it('redirects home to the carte once onboarding is complete (MAP-01)', async () => {
    await setStep('complete');
    render(<Index />);
    expect(await screen.findByText('redirect:/carte')).toBeTruthy();
  });
});

describe('ONB-01 welcome CTA', () => {
  it('persists the phone step and navigates on « Commencer »', async () => {
    await setStep('welcome');
    render(<Welcome />);
    fireEvent.press(screen.getByText(fr['welcome.cta']));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding/phone'));
    await expect(getStep()).resolves.toBe('phone');
  });
});

describe('root layout', () => {
  it('renders without crashing', () => {
    expect(() => render(<RootLayout />)).not.toThrow();
  });
});
