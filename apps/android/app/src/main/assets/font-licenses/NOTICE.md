# Bundled font attribution (SUG-DES-004)

Two families, self-hosted, bundled at build time — no network font fetches at
runtime (`docs/design-system.md` §2 charter rule).

| Family | Weights bundled | `res/font/` resources | Source | License |
|---|---|---|---|---|
| Inter | 400 (Regular), 500 (Medium), 600 (SemiBold) | `inter_regular.ttf`, `inter_medium.ttf`, `inter_semibold.ttf` | [google/fonts, ofl/inter](https://github.com/google/fonts/tree/main/ofl/inter), static instances served via `fonts.gstatic.com` (v20) | SIL Open Font License 1.1 — `OFL-Inter.txt` |
| Space Grotesk | 400 (Regular), 500 (Medium), 600 (SemiBold) | `space_grotesk_regular.ttf`, `space_grotesk_medium.ttf`, `space_grotesk_semibold.ttf` | [google/fonts, ofl/spacegrotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), static instances served via `fonts.gstatic.com` (v22) | SIL Open Font License 1.1 — `OFL-SpaceGrotesk.txt` |

Both fonts ship as variable fonts in the upstream `google/fonts` repo; the
static per-weight TTFs bundled here were fetched from Google Fonts' own
`fonts.gstatic.com` CDN (the same static-instance files Google Fonts serves
to any web page requesting those weights), then committed into `res/font/`
so the app never makes a network request for typography. OFL 1.1 requires
the license accompany redistributed copies of the Font Software — the two
`OFL-*.txt` files alongside this notice are that copy, verbatim from the
`google/fonts` source repo.

Weights map to `DesignTokens.Typography` tokens (`weight: 400/500/600`
only) — no other weights are used anywhere in the charter, so no other
static instances were bundled.
