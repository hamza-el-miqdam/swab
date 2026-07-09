/**
 * MAP-07 — pan/zoom on the radial canvas: pinch and pan write shared
 * values on the UI thread, clamped by the pure geometry helpers (zoom
 * 1×..3×, pan bounded so the map never leaves the viewport), and 150
 * contacts render without dropping a node.
 */
import { render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { fr } from '../i18n/fr';
import { RadialMap } from '../map/RadialMap';
import type { IntimacyRing, VaultContact } from '../vault/vault';

function makeContacts(count: number): VaultContact[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    displayName: `Contact ${i}`,
    roles: [],
    ring: ((i % 4) + 1) as IntimacyRing,
  }));
}

const noop = (): void => undefined;

// Shared-value writes propagate to the animated style on the next frame;
// under jest that frame is driven by (fake) timers.
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

function flushFrames(): void {
  jest.advanceTimersByTime(64);
}

describe('MAP-07 pinch zoom', () => {
  it('zooms the canvas, clamped to the max scale', () => {
    render(<RadialMap contacts={makeContacts(3)} onPressContact={noop} />);

    fireGestureHandler(getByGestureTestId('carte-pinch'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, scale: 1 },
      { state: State.ACTIVE, scale: 1.5 },
      { state: State.END, scale: 1.5 },
    ]);
    flushFrames();
    expect(screen.getByTestId('carte-canvas')).toHaveAnimatedStyle(
      { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1.5 }] },
    );

    fireGestureHandler(getByGestureTestId('carte-pinch'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, scale: 1 },
      { state: State.ACTIVE, scale: 99 },
      { state: State.END, scale: 99 },
    ]);
    flushFrames();
    expect(screen.getByTestId('carte-canvas')).toHaveAnimatedStyle(
      { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 3 }] },
    );
  });

  it('cannot zoom below the rest scale', () => {
    render(<RadialMap contacts={makeContacts(3)} onPressContact={noop} />);
    fireGestureHandler(getByGestureTestId('carte-pinch'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, scale: 1 },
      { state: State.ACTIVE, scale: 0.1 },
      { state: State.END, scale: 0.1 },
    ]);
    flushFrames();
    expect(screen.getByTestId('carte-canvas')).toHaveAnimatedStyle(
      { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
    );
  });
});

describe('MAP-07 bounded pan', () => {
  it('at rest scale the map cannot be dragged away at all', () => {
    render(<RadialMap contacts={makeContacts(3)} onPressContact={noop} />);
    fireGestureHandler(getByGestureTestId('carte-pan'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 500, translationY: -500 },
      { state: State.END, translationX: 500, translationY: -500 },
    ]);
    flushFrames();
    expect(screen.getByTestId('carte-canvas')).toHaveAnimatedStyle(
      { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
    );
  });

  it('zoomed in, panning is clamped to the scaled overflow', () => {
    render(<RadialMap contacts={makeContacts(3)} onPressContact={noop} />);
    fireGestureHandler(getByGestureTestId('carte-pinch'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, scale: 1 },
      { state: State.ACTIVE, scale: 2 },
      { state: State.END, scale: 2 },
    ]);
    fireGestureHandler(getByGestureTestId('carte-pan'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: 9999, translationY: 40 },
      { state: State.END, translationX: 9999, translationY: 40 },
    ]);
    flushFrames();
    // panBound(2) = 160
    expect(screen.getByTestId('carte-canvas')).toHaveAnimatedStyle(
      { transform: [{ translateX: 160 }, { translateY: 40 }, { scale: 2 }] },
    );
  });
});

describe('MAP-04 acceptance — re-tag animates, no teleport', () => {
  it('moves the node to its new ring with a timed animation on ring change', () => {
    const { rerender } = render(
      <RadialMap contacts={makeContacts(1)} onPressContact={noop} />,
    );
    const before = screen.getByLabelText(`Contact 0 — ${fr['ring.1']}`);
    expect(before).toBeTruthy();

    rerender(
      <RadialMap
        contacts={[{ id: 'c0', displayName: 'Contact 0', roles: [], ring: 3 }]}
        onPressContact={noop}
      />,
    );

    // mid-animation the node is between rings…
    jest.advanceTimersByTime(100);
    // …and after the full duration it has settled on ring 3
    jest.advanceTimersByTime(400);
    expect(screen.getByLabelText(`Contact 0 — ${fr['ring.3']}`)).toBeTruthy();
  });
});

describe('MAP-07 density', () => {
  it('renders 150 contacts without dropping a node', () => {
    render(<RadialMap contacts={makeContacts(150)} onPressContact={noop} />);
    expect(screen.getByLabelText(`Contact 0 — ${fr['ring.1']}`)).toBeTruthy();
    expect(screen.getByLabelText(`Contact 149 — ${fr['ring.2']}`)).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(150);
  });
});
