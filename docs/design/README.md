# swab — Design system

Source of truth: [charte-graphique.html](charte-graphique.html) (Charte graphique & identité visuelle v1.0, juillet 2026). The Figma library mirrors it; the charte wins on any disagreement. Owner: the **design-specialist** agent (`agents/design-specialist.md`).

## Figma library

**« swab — Design System »** — <https://www.figma.com/design/igjlLhfd6bGqfStMkfBqZB>

### Variables (built ✅)

| Collection | Mode | Contents |
|---|---|---|
| `Primitives` | Valeur | 24 raw colors from the charte, hidden from pickers (empty scopes): `sombre/*` (encre, bois-sombre, bois, lin, sable, terre, sauge, filet 12 %, sauge-douce 40 %), `clair/*` (lin-clair, blanc, crème, brou, taupe, grège, sauge-profonde, filet 12 %, sauge-profonde-douce 40 %), `etat/*` (établi, apprivoiser, sommeil, pause, tendu, encre-état `#1B1B1B`) |
| `Couleurs` | Sombre | 16 semantic tokens aliased to primitives: `fond/{general,surface,surface-elevee}`, `texte/{principal,secondaire,tertiaire}`, `accent/{defaut,texte-sur-accent,doux}`, `bordure/filet`, `etat/{etabli,apprivoiser,sommeil,pause,tendu,texte-sur-etat}` |
| `Couleurs · Clair` | Clair | The same 16 token names aliased to the light gamme |
| `Espacement` | Valeur | `espace/{xs 4, sm 8, md 12, lg 16, xl 22, 2xl 32}` (22 = button/card padding from the charte) |
| `Rayons` | Valeur | `rayon/{controle 9, bouton 11, carte 13, pilule 999}` — the charte's closed radii vocabulary |

All variables carry scopes and WEB code syntax (`var(--swab-…)`). Semantic tokens never hold raw values — they alias primitives.

> **Why two color collections instead of one with two modes:** the Figma Starter plan allows 1 mode per collection (`addMode` throws). Dark is the brand's primary expression, so components bind to `Couleurs`; `Couleurs · Clair` holds the light twins under identical names. If the team upgrades to Pro, merge them into one collection with Sombre/Clair modes.

### Text styles (built ✅)

`Display 1` (Newsreader Medium 44 / 105 % / −2,5 %) · `Display 2` (Newsreader 29 / 125 % / −1 %) · `Titre 3` (Newsreader Medium 21 / 130 % / −0,5 %) · `Corps` (Hanken Grotesk 15,5 / 155 %) · `Secondaire` (HG 13,5 / 155 %) · `Libellé` (HG SemiBold 11,5 / +9 % / capitales).

### Still to build (blocked on Figma MCP quota)

The Starter plan allows 6 MCP tool calls per month; they were consumed building the foundations above. Remaining phases, in order:

1. **Foundations pages** — Cover (wordmark + صواب + rings), Couleurs (swatches des deux gammes + gamme sémantique + proportions), Typographie (specimens), Motif (cercles d'intimité, rayons 34·55·78·102·130).
2. **Components** (one page each, all properties bound to variables): `Bouton` (Hiérarchie = Primaire / Secondaire / Tertiaire), `Chip d'état` (Sélection × État-relation, dot sémantique), `Avatar` (initiale Newsreader, fond = couleur d'état, texte `#1B1B1B`).
3. QA: contrast pairs from the charte's WCAG table, naming audit, unresolved-binding audit.

**Resume protocol:** run ID `swab-ds-2026-07-07` — every created collection/variable/style is tagged with `sharedPluginData('dsb', 'run_id'|'key')` for idempotent re-runs. Tell the agent: *« Continue the swab design system build, run ID swab-ds-2026-07-07, file igjlLhfd6bGqfStMkfBqZB — foundations are done, start at the doc pages. »*

## Known code↔design drift

`apps/mobile/src/theme.ts` predates the charte: accent `#D9A441` (gold) vs Sauge `#AAC0A2`, text `#F1E8DA` vs Lin `#F0E8DC`, surface `#211A12` vs Bois sombre `#201A14`, and no semantic-state colors. An `area:mobile` issue should align it with the charte tokens above (the charte wins — see design-specialist rule 6).
