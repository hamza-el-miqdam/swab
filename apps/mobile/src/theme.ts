/**
 * Nuit — Swab's dark design tokens.
 * Single source of truth: docs/design-system.md, extracted from the consolidated
 * prototype (docs/design/swab-prototype-consolidated.html). Do not invent values here;
 * add them to the prototype + design-system.md first (area:design), then reflect below.
 */

/** Colour tokens. French names are normative (they match the Penpot library + token contract). */
export const colors = {
  // Surfaces & structure (deepest → raised)
  bg: '#0F1426', // nuit — app background
  surface: '#171E38', // encre — screen / primary card
  surfaceRaised: '#202949', // voile — tags, tiles, rows, inputs
  surfaceHigh: '#28325A', // voile-2 — avatars, switch track
  line: 'rgba(237,235,226,0.12)', // hair — hairline separators / default border
  lineStrong: 'rgba(237,235,226,0.22)', // hair-fort — interactive / ghost outlines

  // Text
  text: '#EDEBE2', // ivoire — primary / high-emphasis
  textDim: '#9AA1C2', // brume — secondary (subtitles, descriptions)
  textMuted: '#6A7194', // ombre — tertiary (labels, meta)

  // Brand accent
  accent: '#E4BE6A', // etoile — primary button, selected, links
  accentInk: '#1C1505', // etoile-encre — text/icon on the accent
  accentTint: 'rgba(228,190,106,0.14)', // selected/chip fill
  accentTrack: 'rgba(228,190,106,0.30)', // switch-on track

  // Status hues (semantic only — never decorative)
  sauge: '#6FBFA3', // positive / lien révélé
  ciel: '#84A9E6', // informational
  corail: '#D98A73', // caution / en retrait (absolute lock)

  // Back-compat alias (older code referenced ringLine)
  ringLine: 'rgba(237,235,226,0.22)',
} as const;

/** Type families & scale. Space Grotesk = display; Inter = UI/body. */
export const typography = {
  display: 'Space Grotesk',
  body: 'Inter',
  size: {
    wordmark: 26,
    title: 20, // ptitle
    doneTitle: 16,
    body: 15,
    button: 15,
    subtitle: 13.5, // psub
    tag: 14,
    label: 11, // flab — uppercase, tracked
    caption: 12,
  },
  lineHeight: {
    display: 1.25,
    body: 1.6,
  },
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  sm: 12,
  m: 16,
  l: 24,
  xl: 32,
} as const;

/** Corner radii. Pill = fully rounded (tags/chips). */
export const radii = {
  input: 10,
  row: 10,
  card: 12,
  button: 12,
  tile: 14,
  pill: 999,
} as const;
