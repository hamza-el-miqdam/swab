/** ONB-01: brand, tagline, promise, single CTA — before ANY input exists. */
import { render, screen } from '@testing-library/react-native';

import Welcome from '../../app/onboarding/welcome';
import { fr } from '../i18n/fr';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('ONB-01 welcome screen', () => {
  it('shows the privacy promise and tagline before any account input', () => {
    render(<Welcome />);
    expect(screen.getByText(fr['welcome.promise'])).toBeTruthy();
    expect(screen.getByText(fr['welcome.tagline'])).toBeTruthy();
    expect(screen.getByText('swab · صواب')).toBeTruthy();
  });

  it('offers exactly one action: « Commencer »', () => {
    render(<Welcome />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText(fr['welcome.cta'])).toBeTruthy();
  });
});
