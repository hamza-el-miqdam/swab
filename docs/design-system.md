# Swab — Design System (« Nuit »)

> **Single source of truth for design tokens and component grammar.**
> Extracted verbatim from the consolidated app prototype
> ([`docs/design/swab-prototype-consolidated.html`](design/swab-prototype-consolidated.html)) — gabarit iPhone 17,
> 402 × 874 pt (@3x). The Penpot design library and `packages/ui` primitives derive from this file. **Do not invent values** — if something is
> missing here, add it to the prototype first, then reflect it here (design agent, `area:design`).
>
> Owner: Design & Design-System Specialist (`agents/design-specialist.md`, `area:design`). Product law 5
> (calm by design) is binding: nothing here may introduce counters, celebration, or urgency affordances.

_Last updated: 2026-08-08_

## 1. Colour tokens

The palette is a single dark theme called **Nuit**. Names are French and normative (they are the token
names in Penpot and the keys in the app theme). Neutrals descend from deepest surface to brightest text;
`étoile` is the sole brand accent; the three status hues are used sparingly and never for decoration.

### Surfaces & structure

| Token | Hex / value | Role |
|---|---|---|
| `nuit` | `#0F1426` | App background (deepest). Carries a faint radial gold glow, top-left (`etoile-lueur`, `rgba(228,190,106,.05)`). |
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
| `ombre` | `#8A91B5` | Tertiary text — labels, meta, muted values. **Not for use on `voile-2`** — see the AA note below (changed from `#6A7194` 2026-08-08, SUG-DES-002: the old value failed WCAG AA on every Nuit surface at the sizes it's used at). |

> **Contrast rule:** `ombre` measures 5.92:1 on `nuit`, 5.31:1 on `encre`, 4.61:1 on `voile` — all ≥ 4.5:1
> AA — but only 4.01:1 on `voile-2`, below the AA floor. `ombre` may not be used for text on `voile-2`;
> the minimum text token on `voile-2` is `brume` (4.87:1). `ombre` remains visibly dimmer than `brume`
> (7.18–4.87:1 across the same surfaces), preserving the primary/secondary/tertiary hierarchy.

### Brand accent

| Token | Hex | Role |
|---|---|---|
| `etoile` | `#E4BE6A` | Primary accent — primary button, selected state, links, eyebrow. |
| `etoile-encre` | `#1C1505` | Ink **on** `étoile` (text/icon over the gold button). |

Accent tints (derived, base `#E4BE6A` at reduced opacity — tokenized 2026-08-08, SUG-DES-008):

| Token | Value | Role |
|---|---|---|
| `etoile-voile` | `rgba(228,190,106,.14)` | Chip / selected fill. |
| `etoile-piste` | `rgba(228,190,106,.30)` | Switch-on track. |
| `etoile-lueur` | `rgba(228,190,106,.05)` | `nuit` background's radial gold glow — decoration, not a status hue. |

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

- **Spacing scale** (px): `4 · 8 · 12 · 14 · 16 · 20 · 24` — SSOT keys `spacing.xs/s/sm/m/ml/l/xl`
  (`packages/ui/tokens/tokens.json`; reconciled 2026-08-08, SUG-DES-009 — this contract and the SSOT
  previously disagreed). Screen content padding `14 20 20` — `component.screen.paddingTop/paddingHorizontal/paddingBottom`.
  Section label top margin `15`.
- **Radii** (px): input/row `10`, card/button `12`, tile `14`, pill/tag `999`, avatar `50%`, device screen `57`, device body `64`.
- **Borders**: `1px` `hair` (default) / `hair-fort` (interactive & ghost).
- **Device frame**: screen 402 × 874, status bar 62, top bar 44, home bar 34, Dynamic Island 124 × 35.
  Shell/Dynamic-Island fill `#05070F` is presentation chrome only (the device bezel, not the app UI)
  and is intentionally outside the token set (SUG-DES-014).
- **Hit targets**: buttons pad `14`; tags pad `8 14`; segmented cells pad `10 2`.
- **Touchable feedback**: primary button `:active` scales to `.985`; border-color transitions `.15s`.

## 4. Component grammar

Derived from the prototype. Each becomes a Penpot component (with variants where a `.sel`/state axis
exists); its geometry tokens live in `packages/ui/tokens/tokens.json` (`component` section), and each
native app builds its own primitive from the generated `DesignTokens` (SwiftUI in `apps/ios/Sources/SwabUI`,
Compose in `apps/android`).

| Component | Variants / states | Notes |
|---|---|---|
| **Button — primary** | default, active | `étoile` fill, `étoile-encre` text, radius 12, full-width. |
| **Button — ghost** | default | transparent, `hair-fort` border, `ivoire` text. |
| **Text button** | default | underlined, `ombre`, centred; low-emphasis exits. |
| **Text field** | empty, focused, error | `voile` fill, radius 10 (input/row radius), `hair` border default → `étoile` border on focus → `corail` border + inline `errmsg` on error. Label uses `flab` (11px Inter, uppercase, `ombre`). Used for phone number, display name. |
| **OTP code input** | empty, filled, focused, error | Six individual digit boxes, same fill/radius family as Text field (`voile`, radius 10); square proportions derived from the `tile`/`rowi` geometry rather than invented dimensions. Auto-advance on input; error state = `corail` border, calm inline copy (e.g. "Code incorrect, réessayez") — never "error red". |
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

Tokenized in `packages/ui/tokens/tokens.json`'s `motion` section (`DesignTokens.Motion` on native,
`--motion-*` custom properties on web) since 2026-08-08 (SUG-DES-007) — consumers reference the token,
not hand-copied prose numbers.

- Screen transitions: 0.28s fade + 4px rise, `ease` easing — `motion.screenTransition`
  (`durationMs`/`riseDistance`/`easing`). Respect `prefers-reduced-motion` — `motion.reducedMotion`
  = `"disable-all"` is a documented behavior contract; enforcement is per-platform (Compose
  `LocalAccessibilityManager`, iOS `UIAccessibility.isReduceMotionEnabled`, web media query).
- Border-color transitions (text field/tag/tile focus & selection): 0.15s — `motion.borderTransition`.
- Switch thumb transform/background transition: 0.2s — `motion.controlTransition`.
- Primary button `:active` scale: `.985` — `motion.pressScale`.
- No progress bars, no "match!" moment, no confetti — success is a quiet ring + one sentence. Motion
  tokens are for calm fades/transitions only; no `celebration*` tokens.

## 5. How this maps out

The token chain has exactly one hand-edited link; everything past it is generated and mechanically
regenerated from that link — see the "Design reference ownership" paragraph in
`agents/design-specialist.md` for the full rule.

| Stage | Location | Status |
|---|---|---|
| 1. Penpot library | connected Penpot file → **Swab — Design System** page, token set "Nuit" | colour styles, typographies, components, tokens (source of the values below) |
| 2. Canonical export (hand-edited) | [`packages/ui/tokens/tokens.json`](../packages/ui/tokens/tokens.json) | `color`, `typography`, `spacing`, `radius`, `component` — the ONLY place these values are hand-edited in code |
| 3. Generated — web/TS | `packages/ui/src/tokens.ts`, `packages/ui/src/tokens.css` | typed `as const` exports + `:root` custom properties; consumed once `apps/web` exists |
| 3. Generated — iOS | `apps/ios/Sources/SwabCore/Generated/DesignTokens.swift` | plain hex/numeric constants, no SwiftUI import; consumed by `Carte/CarteTheme.swift` (wired 2026-07-19, `area:ios`) |
| 3. Generated — Android | `apps/android/app/src/main/kotlin/com/swab/android/ui/theme/DesignTokens.kt` | plain Kotlin object, no Compose import; consumed by `ui/theme/Theme.kt` (wired 2026-07-19, `area:android`) |

Regenerate stage 3 from stage 2 with `node packages/ui/scripts/generate.mjs` (`--check` for CI drift — the
same convention as `scripts/render-agents.mjs`). Never hand-edit a generated file; the banner comment at the
top of each names its source. The `--check` drift guard runs as `packages/ui`'s `test` script
(`pnpm --filter @repo/ui test`, also exercised by `pnpm turbo run test`) — SUG-DES-003.

When any of these changes, update this file, the prototype, and `tokens.json` (+ regenerate) in the same PR
so code and design never disagree (rule G5).
