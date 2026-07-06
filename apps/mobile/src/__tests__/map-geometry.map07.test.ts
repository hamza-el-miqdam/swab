/**
 * MAP-07 — geometry stays sane at density: 150 contacts per ring produce
 * finite, deterministic, in-canvas positions. Plus the pure pan/zoom clamp
 * helpers (no JS-thread surprises inside gesture worklets).
 */
import {
  MAP_SIZE,
  NODE_HALF_HEIGHT,
  NODE_HALF_WIDTH,
  RINGS,
  clamp,
  panBound,
  positionOn,
  ringRadius,
} from '../map/geometry';

const DENSITY = 150;
// ringRadius(4) slightly exceeds MAP_SIZE/2 by design (chips hug the edge);
// allow a 5% margin rather than pretending the canvas is a hard wall.
const CANVAS_TOLERANCE = MAP_SIZE * 0.05;

describe('MAP-07 radial geometry at density', () => {
  it.each(RINGS.map((r) => [r] as const))(
    'ring %d: 150 positions are finite, deterministic, and on the ring',
    (ring) => {
      for (let i = 0; i < DENSITY; i += 1) {
        const a = positionOn(ring, i);
        const b = positionOn(ring, i);
        expect(a).toEqual(b); // deterministic — no jumps between renders

        expect(Number.isFinite(a.left)).toBe(true);
        expect(Number.isFinite(a.top)).toBe(true);

        // undo the chip offset to recover the node center
        const cx = a.left + NODE_HALF_WIDTH;
        const cy = a.top + NODE_HALF_HEIGHT;
        const r = Math.hypot(cx - MAP_SIZE / 2, cy - MAP_SIZE / 2);
        expect(r).toBeCloseTo(ringRadius(ring), 6);

        expect(cx).toBeGreaterThanOrEqual(-CANVAS_TOLERANCE);
        expect(cx).toBeLessThanOrEqual(MAP_SIZE + CANVAS_TOLERANCE);
        expect(cy).toBeGreaterThanOrEqual(-CANVAS_TOLERANCE);
        expect(cy).toBeLessThanOrEqual(MAP_SIZE + CANVAS_TOLERANCE);
      }
    },
  );

  it('rings are strictly ordered: closer intimacy sits closer to « moi »', () => {
    expect(ringRadius(1)).toBeLessThan(ringRadius(2));
    expect(ringRadius(2)).toBeLessThan(ringRadius(3));
    expect(ringRadius(3)).toBeLessThan(ringRadius(4));
  });
});

describe('MAP-07 pan/zoom clamps (pure)', () => {
  it('clamp bounds a value into [lo, hi]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('panBound grows with zoom and is zero at rest scale', () => {
    expect(panBound(1)).toBe(0);
    expect(panBound(2)).toBeGreaterThan(0);
    expect(panBound(3)).toBeGreaterThan(panBound(2));
  });

  it('a pan clamped by panBound never reveals space beyond the scaled map', () => {
    const scale = 2.5;
    const bound = panBound(scale);
    expect(clamp(9999, -bound, bound)).toBe(bound);
    expect(clamp(-9999, -bound, bound)).toBe(-bound);
    // scaled overflow on one side is (scale-1)*MAP_SIZE/2
    expect(bound).toBeLessThanOrEqual(((scale - 1) * MAP_SIZE) / 2 + 1e-9);
  });
});
