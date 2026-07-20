# SUG-DES-012 — No Dynamic Type / font-scaling contract; letter-spacing tokens are absolute px snapshots of em-based charter values

- **Area:** design
- **Topic:** accessibility
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md) for the contract/tokens; ios-specialist / android-specialist for platform adoption
- **Related requirement IDs:** n/a

## Problem / Opportunity

Two related gaps in the typography contract:

1. **Scaling is unspecified.** `tokens.json:25-34` stores absolute px sizes; neither `docs/design-system.md` §2 (`:56-78`) nor the SSOT says whether text scales with the user's OS text-size setting (iOS Dynamic Type, Android sp/font-scale). Without a stated contract, one platform will bake `Font.custom(size: 15)` fixed while the other uses `15.sp` (which scales) — divergent behavior and an accessibility failure on whichever platform pins px. (Today nothing consumes the typography tokens at all — SUG-DES-004 — so the contract can still be set before first adoption, which is exactly the cheap moment.)
2. **Letter-spacing lost its unit semantics in extraction.** The charter defines tracking relatively: wordmark "tracking `.22–.24em`" (`design-system.md:69`), label "tracking `.1em`" (`:76`), chip `.06em` (`docs/design/swab-prototype-consolidated.html:59`). The SSOT stores computed px: `letterSpacing: 5.7` for wordmark (= 26 × 0.22) and `1.1` for label (= 11 × 0.1) (`tokens.json:26`, `:34`). If a size ever changes (or text scales per point 1), the baked px tracking silently stops matching the charter's em intent — the derivation is invisible to consumers.

## Implementation plan

1. design-specialist decision + contract text in `docs/design-system.md` §2 (recommended, matching the calm/accessible ethos): "All type styles scale with the platform text-size setting (Dynamic Type via `UIFontMetrics`/`relativeTo:` on iOS, `sp` units on Android, `rem` on web). Token sizes are the reference size at default scale (1.0). Letter-spacing is em-relative and multiplies the *rendered* size."
2. Change `letterSpacing` in `tokens.json` typography entries to em values with an explicit unit key so the generator can't be misread: `"letterSpacingEm": 0.22` (wordmark), `0.1` (label), `0` elsewhere. Update `generate.mjs` typography renderers (`generate.mjs:96-102`, `:153-161`, `:240-246`, `:324-330`): CSS emits `letter-spacing: .22em`; TS/Swift/Kotlin emit `letterSpacingEm` and drop the px field. This is a generated-API rename — currently free (zero consumers, verified by grep in SUG-DES-004).
3. Regenerate all four outputs; update `design-system.md` §2 tables to show em values only (they already do — the px snapshot exists only in the SSOT).
4. `area:ios`/`area:android` proposals reference the new contract for their SUG-DES-004 wiring (`tracking(size * em)` iOS / `letterSpacing = em.em` Compose).
5. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- `generate.mjs --check` green; `tokens.css` shows `--font-wordmark-letter-spacing: 0.22em;` and no px letter-spacing remains.
- SUG-DES-005 validator (if landed) updated: `letterSpacingEm` a number in [0, 0.5].
- design-system.md §2 contains the scaling contract sentence; ios/android proposals cite it.

## Risks & gotchas

- Order before SUG-DES-004's implementation lands, or coordinate the rename with the consuming specialists in one window — after adoption it becomes a three-platform breaking change.
- Dynamic-type scaling of *fixed-height* components (button height 48, `tokens.json:53`) needs a stated behavior too — recommend "minimum height, grows with text" phrasing in the same contract paragraph, otherwise scaled text will clip.
- Wordmark uses a range in the charter (".22–.24em", 26–30 px, `design-system.md:69`) — the SSOT must pick one canonical pair (currently 26/0.22); state that explicitly rather than leaving the range ambiguity.
