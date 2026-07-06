/**
 * FS-02 radial geometry — pure math, no React, no I/O (MAP-01/07).
 * Extracted verbatim from the ONB-04 calibration screen so both surfaces
 * share one spatial truth. `clamp`/`panBound` are worklet-safe for the
 * pan/zoom gestures (UI thread only — mobile rules 3–4).
 */
import type { IntimacyRing } from '../vault/vault';

export const MAP_SIZE = 320;

export const RINGS: readonly IntimacyRing[] = [1, 2, 3, 4];

/** Chip offsets used by positionOn (half the calibrate chip footprint). */
export const NODE_HALF_WIDTH = 28;
export const NODE_HALF_HEIGHT = 14;

export function ringRadius(ring: IntimacyRing): number {
  'worklet';
  return (MAP_SIZE / 2) * (ring / 4.6) + 24;
}

/** Deterministic angular spread per ring — stable positions, no jumps. */
export function positionOn(ring: IntimacyRing, index: number): { top: number; left: number } {
  const angle = index * 2.399963; // golden angle, avoids overlap clumping
  const r = ringRadius(ring);
  return {
    left: MAP_SIZE / 2 + r * Math.cos(angle) - NODE_HALF_WIDTH,
    top: MAP_SIZE / 2 + r * Math.sin(angle) - NODE_HALF_HEIGHT,
  };
}

/** Bound a value into [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(value, lo), hi);
}

/**
 * Max pan offset (either axis) at a given zoom: the scaled map's overflow
 * on one side. Zero at rest — the map cannot be pushed off-screen.
 */
export function panBound(scale: number): number {
  'worklet';
  return Math.max(0, (MAP_SIZE * (scale - 1)) / 2);
}
