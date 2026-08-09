# Bundled font attribution (SUG-DES-004)

Two families, self-hosted, bundled at build time — no network font fetches at
runtime (`docs/design-system.md` §2 charter rule). Registered via
`UIAppFonts` in `App/Info.plist`; consumed through
`SwabUI/Components/Typography.swift`.

| Family | Weights bundled | Files | Source | License |
|---|---|---|---|---|
| Inter | 400 (Regular), 500 (Medium), 600 (SemiBold) | `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf` | [google/fonts, ofl/inter](https://github.com/google/fonts/tree/main/ofl/inter), static instances served via `fonts.gstatic.com` (v20) | SIL Open Font License 1.1 — `OFL-Inter.txt` |
| Space Grotesk | 400 (Regular), 500 (Medium), 600 (SemiBold) | `SpaceGrotesk-Regular.ttf`, `SpaceGrotesk-Medium.ttf`, `SpaceGrotesk-SemiBold.ttf` | [google/fonts, ofl/spacegrotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), static instances served via `fonts.gstatic.com` (v22) | SIL Open Font License 1.1 — `OFL-SpaceGrotesk.txt` |

Both fonts ship as variable fonts in the upstream `google/fonts` repo; the
static per-weight TTFs bundled here were fetched from Google Fonts' own
`fonts.gstatic.com` CDN (the same files Google Fonts serves to any web page
requesting those weights), then committed here so the app never makes a
network request for typography. OFL 1.1 requires the license accompany
redistributed copies of the Font Software — the two `OFL-*.txt` files
alongside this notice are that copy, verbatim from the `google/fonts` source
repo. (Same source and license as `apps/android/.../assets/font-licenses/`.)

**iOS-specific gotcha, not present on Android:** Google's static-instance
export embeds *every* Space Grotesk weight (300–700) under the internal
family name "Space Grotesk Light" (verified directly against the files —
their `name` table family is "Space Grotesk Light" for the 400/500/600
instances alike, not just an actual lighter weight). Android references
fonts by `res/font/` resource name and is unaffected; iOS's
`Font.custom(name:...)` resolves by the font's own embedded PostScript name,
so `Typography.swift` maps to `SpaceGroteskLight-Regular/-Medium/-SemiBold`,
not `SpaceGrotesk-*`. `Tests/SwabUITests/TypographyFontBundlingTests.swift`
guards this mapping against drift.

Weights map to `DesignTokens.Typography` tokens (`weight: 400/500/600`
only) — no other weights are used anywhere in the charter, so no other
static instances were bundled.
