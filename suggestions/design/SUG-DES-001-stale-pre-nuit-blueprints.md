# SUG-DES-001 — Six standalone blueprints still carry the pre-Nuit charter (brown palette + Hanken Grotesk)

- **Area:** design
- **Topic:** consistency
- **Impact:** high
- **Effort:** L
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a (cross-flow; touches the normative design input of FS-01..06)

## Problem / Opportunity

The design chain rule says blueprints are "living documents" and "a change anywhere in this chain must propagate down or be flagged — never let the prototype, token contract, Penpot, and blueprints tell different stories silently" (`agents/design-specialist.md:47-52`). They currently tell different stories:

- All six per-flow standalone blueprints (`blueprints/swab - {Carte des relations, Fiche contact, Flux envie et match, Onboarding, Paramètres modaux, Sous-groupes} (standalone)*.html`) are built on the retired brown/gold palette — e.g. `blueprints/swab - Onboarding (standalone) (1).html:8`, `:10`, `:24` all use background `#16120D`, the exact "stale brown" the iOS fix commit (23e26bd) removed from `CarteTheme`. A hex inventory of each file shows `#16120d`, `#d8b27a`, `#2c2a26`, `#9a978f` etc. dominating; **none** of the Nuit tokens (`#0f1426`, `#171e38`, `#e4be6a`…) appear in any of the six.
- They also use the typeface **Hanken Grotesk** (embedded `@font-face` blocks, e.g. `blueprints/swab - Onboarding (standalone) (1).html:184`; one match per file in all six), not the charter's Space Grotesk + Inter (`docs/design-system.md:56-65`, `agents/design-specialist.md:62-65`).
- Only the consolidated prototype (`docs/design/swab-prototype-consolidated.html`, `:root` palette at lines 11-19) uses the Nuit tokens.

Any spec or app work that consults a per-flow blueprint (design-specialist.md names them normative inputs to `/speckit-specify`) sees the wrong charter.

## Implementation plan

1. Decide (with the user / an `area:design` issue) between the two honest options:
   - **Option A (recommended, cheaper first step):** mark the six standalone files as superseded — prepend an HTML comment banner + a visible top-of-page notice: `<!-- SUPERSEDED 2026-07-19: palette/typography predate the « Nuit » charter. Normative visual reference: docs/design/swab-prototype-consolidated.html + docs/design-system.md. Flow structure/copy here may still be referenced; visual values may NOT. -->`. Log the divergence in root `CHANGELOG.md` and note it in `docs/STATUS.md`'s Design system row.
   - **Option B (full fix):** re-skin each standalone blueprint to the Nuit `:root` variable block copied from `docs/design/swab-prototype-consolidated.html:11-19` (tokens `--nuit --encre --voile --voile-2 --hair --hair-fort --ivoire --brume --ombre --etoile --etoile-encre --sauge --ciel --corail`) and swap Hanken Grotesk for Space Grotesk/Inter. One PR per file to stay under the 400-line PR limit (G4) — these files are ~950 KB each, so prefer Option A unless the files are regenerated from Penpot.
2. Either way, keep French copy in the standalone files untouched (copy is separately normative).
3. Do NOT delete the files silently — flow structure and copy still feed specs.

## Tests & acceptance criteria

- After Option A: `grep -L "SUPERSEDED" blueprints/swab\ -\ *.html` returns empty (all six carry the banner).
- After Option B: `grep -ci "16120d\|Hanken" <file>` returns 0 for each migrated file, and `grep -c "0f1426"` ≥ 1.
- Root `CHANGELOG.md` entry + `docs/STATUS.md` design row updated in the same PR.

## Risks & gotchas

- The six files are tool-exported bundles (embedded `__bundler_thumbnail`, data-URL fonts) — hand-editing their inline CSS is brittle; that's why Option A (explicit supersession flag) is the safe first move.
- The 5-état taxonomy in the Carte blueprint is a separately flagged divergence (`apps/ios/Sources/SwabCore/Carte/EtatColors.swift:1-7`) — do not "fix" it while re-skinning.
