/**
 * MAP-02 — primary navigation exposes exactly Carte / Envie / Sous-groupes.
 * No badges, no unread counters (product law 5): the bar renders labels
 * only, and each surface is reachable. Placeholder surfaces stay calm.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import Envie from '../../app/(main)/envie';
import SousGroupes from '../../app/(main)/sous-groupes';
import { fr } from '../i18n/fr';
import { NavBar } from '../ui/nav-bar';

const mockPush = jest.fn();
let mockPathname = '/carte';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => mockPathname,
}));

beforeEach(() => {
  mockPush.mockReset();
  mockPathname = '/carte';
});

describe('MAP-02 navigation bar', () => {
  it('exposes exactly three surfaces: Carte, Envie, Sous-groupes', () => {
    render(<NavBar />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByText(fr['nav.carte'])).toBeTruthy();
    expect(screen.getByText(fr['nav.envie'])).toBeTruthy();
    expect(screen.getByText(fr['nav.sousGroupes'])).toBeTruthy();
  });

  it('renders no badge, counter, or digit anywhere in the bar', () => {
    render(<NavBar />);
    const displayed: string[] = [];
    const collect = (node: unknown): void => {
      if (typeof node === 'string') {
        displayed.push(node);
      } else if (Array.isArray(node)) {
        node.forEach(collect);
      } else if (node !== null && typeof node === 'object' && 'children' in node) {
        collect((node as { children?: unknown }).children);
      }
    };
    collect(screen.toJSON());
    expect(displayed.sort()).toEqual(
      [fr['nav.carte'], fr['nav.envie'], fr['nav.sousGroupes']].sort(),
    );
    for (const text of displayed) {
      expect(text).not.toMatch(/\d/u);
    }
  });

  it('marks the active surface for assistive tech and navigates on press', () => {
    mockPathname = '/envie';
    render(<NavBar />);
    expect(screen.getByLabelText(fr['nav.envie']).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText(fr['nav.carte']).props.accessibilityState).toMatchObject({
      selected: false,
    });

    fireEvent.press(screen.getByText(fr['nav.sousGroupes']));
    expect(mockPush).toHaveBeenCalledWith('/sous-groupes');
  });

  it('does not re-push the surface you are already on', () => {
    mockPathname = '/carte';
    render(<NavBar />);
    fireEvent.press(screen.getByText(fr['nav.carte']));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('MAP-02 placeholder surfaces', () => {
  it('Envie renders its calm placeholder', () => {
    render(<Envie />);
    expect(screen.getByText(fr['envie.title'])).toBeTruthy();
    expect(screen.getByText(fr['envie.placeholder'])).toBeTruthy();
  });

  it('Sous-groupes renders its calm placeholder', () => {
    render(<SousGroupes />);
    expect(screen.getByText(fr['sousgroupes.title'])).toBeTruthy();
    expect(screen.getByText(fr['sousgroupes.placeholder'])).toBeTruthy();
  });
});
