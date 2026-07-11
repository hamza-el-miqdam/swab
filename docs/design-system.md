# Swab — Design System (« Nuit »)

> **Single source of truth for design tokens and component grammar.**
> Extracted verbatim from the consolidated app prototype
> ([`docs/design/swab-prototype-consolidated.html`](design/swab-prototype-consolidated.html)) — gabarit iPhone 17,
> 402 × 874 pt (@3x). The Penpot design library, `apps/mobile/src/theme.ts`, and any future
> `packages/ui` primitives all derive from this file. **Do not invent values** — if something is
> missing here, add it to the prototype first, then reflect it here (design agent, `area:design`).
>
> Owner: Design System Steward (`agents/design-system-specialist.md`). Product law 5 (calm by design)
> is binding: nothing here may introduce counters, celebration, or urgency affordances.

_Last updated: 2026-07-07_

## 1. Colour tokens

The palette is a single dark theme called **Nuit**. Names are French and normative (they are the token
names in Penpot and the keys in the app theme). Neutrals descend from deepest surface to brightest text;
`étoile` is the sole brand accent; the three status hues are used sparingly and never for decoration.

### Surfaces & structure

| Token | Hex / value | Role |
|---|---|---|
| `nuit` | `#0F1426` | App background (deepest). Carries a faint radial gold glow, top-left. |
| `encre` | `#171E38` | Screen / primary card surface. |
| `voile` | `#202949` | Raised surface — tags, tiles, list rows, inputs. |
| `voile-2` | `#28325A` | Higher surface — avatars, switch track (off). |
| `hair` | `rgba(237,235,226,.12)` | Hairline separators & default borders. |
| `hair-fort` | `rgba(237,235,226,.22)` | Stronger border — interactive outlines, ghost buttons. |

### Text

| Token | Hex | Role |
|---|---|---|
| `ivoire` | `#EDEBE2` | Primary text / high-emphasis. |
| `brume` | `#9AA1C2` | Secondary text — subtitles, descriptions. |
| `ombre` | `#6A7194` | Tertiary text — labels, meta, muted values. |

### Brand accent

| Token | Hex | Role |
|---|---|---|
| `etoile` | `#E4BE6A` | Primary accent — primary button, selected state, links, eyebrow. |
| `etoile-encre` | `#1C1505` | Ink **on** `étoile` (text/icon over the gold button). |

Accent tints (derived, used for chip/selected fills): `rgba(228,190,106,.14)` fill, `rgba(228,190,106,.30)` switch-on track.

### Status hues (semantic, never decorative)

| Token | Hex | Meaning |
|---|---|---|
| `sauge` | `#6FBFA3` | Positive / **révélé** — reciprocal link revealed, success rings, "generated locally". |
| `ciel` | `#84A9E6` | Informational / neutral node accent. |
| `corail` | `#D98A73` | Caution / **en retrait** — the absolute-lock presence state. Never an "error red". |

## 2. Typography

Two families, self-hosted (no external font requests in production — `next/font` on web, bundled on mobile).

| Family | Weights | Usage |
|---|---|---|
| **Space Grotesk** | 400, 500, 600 | Display & headings — wordmark, screen titles (`ptitle`), success titles. `font-weight:500`, `line-height:1.25`. Wordmark uses wide tracking (`.22em`). |
| **Inter** | 400, 500, 600 | Everything else — body, UI, labels, buttons. Base `15px / 1.6`. |

### Type scale (px)

| Role | Family | Size | Weight | Notes |
|---|---|---|---|---|
| Wordmark | Space Grotesk | 26–30 | 500 | tracking `.22–.24em` |
| Screen title `ptitle` | Space Grotesk | 20 | 500 | |
| Success title `donehead b` | Space Grotesk | 16 | 500 | |
| Body | Inter | 15 | 400 | line-height 1.6 |
| Button | Inter | 15 | 500 | |
| Subtitle `psub` | Inter | 13.5 | 400 | colour `brume` |
| Tag / row | Inter | 13–14 | 400 | |
| Field label `flab` | Inter | 11 | 400 | UPPERCASE, tracking `.1em`, colour `ombre` |
| Eyebrow / chip | Inter | 11 | 400 | UPPERCASE, tracking `.06–.18em` |
| Meta / caption | Inter | 11–12.5 | 400 | colour `ombre` / `brume` |

## 3. Spacing, radii, sizing

- **Spacing scale** (px): `4 · 8 · 12 · 14 · 16 · 20 · 24`. Screen content padding `14 20 20`. Section label top margin `15`.
- **Radii** (px): input/row `10`, card/button `12`, tile `14`, pill/tag `999`, avatar `50%`, device screen `57`, device body `64`.
- **Borders**: `1px` `hair` (default) / `hair-fort` (interactive & ghost).
- **Device frame**: screen 402 × 874, status bar 62, top bar 44, home bar 34, Dynamic Island 124 × 35.
- **Hit targets**: buttons pad `14`; tags pad `8 14`; segmented cells pad `10 2`.
- **Touchable feedback**: primary button `:active` scales to `.985`; border-color transitions `.15s`.

## 4. Component grammar

Derived from the prototype. Each becomes a Penpot component (with variants where a `.sel`/state axis
exists) and, on mobile, a primitive in `apps/mobile/src/ui.tsx` (later `packages/ui`).

| Component | Variants / states | Notes |
|---|---|---|
| **Button — primary** | default, active | `étoile` fill, `étoile-encre` text, radius 12, full-width. |
| **Button — ghost** | default | transparent, `hair-fort` border, `ivoire` text. |
| **Text button** | default | underlined, `ombre`, centred; low-emphasis exits. |
| **Tag / chip** | unselected, selected | pill; selected = `étoile` border + text. `chip` = filled accent tint; `chip.gris` = neutral tint. |
| **Segmented control** | option, selected, **retrait**-selected | selected = `étoile`; the `retrait` option selects to `corail` (absolute lock). |
| **Intimacy levels** | 4 ordinal cells | Noyau · Proches · Amis · Élargi; selected = `étoile`. |
| **Tile** | default, hover | 2-col grid; `étoile`-stroked icon + label; card on `voile`. |
| **List row (`rowi`)** | default, selected | label + optional sub + count/chevron; selected = `étoile` border. |
| **Person row** | — | 44px avatar (initials, `voile-2`) + name + relation caption. |
| **Key-value card (`paycard`)** | row, total row | `encre`/`voile` card; muted key, value; `total` row separated by `hair`. |
| **Switch** | off, on | 38 × 21 track; off `voile-2`/`brume`, on accent-tint track + `étoile` thumb. |
| **Budget slider** | — | range, `étoile` accent, live output; strict ceiling copy. |
| **Journal timeline** | node, highlighted node | vertical connector `hair-fort`; highlighted node fills `sauge`. |
| **Feed item** | — | status dot + text + timestamp; dot colour from status hue. |
| **Done header** | — | 54px ring (`sauge` or `étoile` stroke) + title + subtitle; success/confirmation screens. |
| **Privacy note (`note`)** | — | small icon (outline, `ombre`) + calm explanatory copy; the recurring privacy reassurance. |
| **Device chrome** | — | status bar, top bar (back + eyebrow title), home indicator. Presentation frame only. |

### Interaction & motion

- Screen transitions: 0.28s fade + 4px rise. Respect `prefers-reduced-motion` (disable all).
- No progress bars, no "match!" moment, no confetti — success is a quiet ring + one sentence.

## 5. How this maps out

| Consumer | Location | Derives |
|---|---|---|
| Penpot library | connected Penpot file → **Swab — Design System** page | colour styles, typographies, components, tokens |
| Mobile | `apps/mobile/src/theme.ts` | `colors`, `typography`, `spacing`, `radii` |
| Web (future) | `packages/ui` tokens | same token names via CSS custom properties |

When any of these changes, update this file **and** the prototype in the same PR so code and design never
disagree (rule G5).
