# SUG-DES-005 — `generate.mjs` does no input validation; a typo in tokens.json silently generates broken output

- **Area:** design
- **Topic:** codegen
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

`packages/ui/scripts/generate.mjs` trusts its hand-edited input completely:

- `generate.mjs:29` — `JSON.parse(readFileSync(...))` then straight into templating. No schema check at all (contrast with G1's "validate ALL input at every boundary … data crossing package boundaries").
- `hexToRgbTriplet` (`generate.mjs:60-66`) does `parseInt` on fixed slices — a 3-digit hex, a missing `#`, or `#GGGGGG` yields `NaN, NaN, NaN` written into `tokens.css` without error.
- Missing typography fields render literally: `size: ${t.size}` (`generate.mjs:99`, `:243`, `:327`) writes `undefined` into TS/Swift/Kotlin. Swift/Kotlin would fail much later at native compile (outside the turbo pipeline); `tokens.ts`/`tokens.css` fail only at web typecheck or never (CSS is not typechecked).
- `splitRef` (`generate.mjs:69-72`) never verifies the referenced token exists: `"radiusToken": "radius.buton"` generates `Radius.buton` (native compile error, discovered late) and `var(--radius-buton)` (silently invalid CSS custom property).
- Opacity is not range-checked (`generate.mjs:88-89`, `:213-215`) — `"opacity": 12` would flow into `rgba(..., 12)` and iOS alpha baking (`CarteTheme.swift:30-33` multiplies by 255).
- Unknown top-level sections or color keys are silently ignored/passed through — a misspelled group never fails.

## Implementation plan

1. Add a `validate(tokens)` function at the top of `generate.mjs` (no new deps — plain JS, keeping the zero-dependency script), run before any build*:
   - `meta` present with `name/source/rule/lastUpdated` strings.
   - Exactly the known top-level keys: `meta, color, typography, spacing, radius, component` — fail on extras.
   - Every `color.*.value` matches `/^#[0-9a-f]{6}$/i`; `opacity`, when present, is a number in (0, 1).
   - Every typography entry has `family` (one of `"Space Grotesk" | "Inter"` — charter rule 5, no new typefaces), numeric `size > 0`, `weight` in {400,500,600}, numeric `lineHeight > 0`, numeric `letterSpacing >= 0`, `textTransform` in {"none","uppercase"}.
   - `spacing.*` / `radius.*` are positive numbers.
   - For every `component` key ending in `Token`: value matches `/^(radius|color)\.[\w-]+$/` AND the referenced key exists in `tokens[category]`; other values are positive numbers or strings.
2. On violation: `console.error` each problem with its JSON path, `process.exit(1)` (both in write and `--check` mode).
3. Self-test without a framework: add `node packages/ui/scripts/generate.mjs --check` runs (already suggested as the `test` script in SUG-DES-003); additionally a tiny `scripts/generate.test.mjs` using `node:test` + `node:assert` that feeds bad fixtures (bad hex, dangling ref, opacity 12, missing size) to the exported `validate` and expects throws — wire as part of the `test` script.
4. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- `node --test packages/ui/scripts/generate.test.mjs` green; each bad-fixture case rejected with a path-qualified message.
- Mutating `tokens.json` (`"value": "#0f142"`) makes both `generate` and `--check` exit 1 before writing anything.
- Valid current `tokens.json` produces byte-identical output to today's generated files (`git diff --exit-code` after regeneration).

## Risks & gotchas

- Keep validation messages listing the JSON path (`color.voile-2.value`) — the file is hand-edited by the design agent, so errors must be actionable.
- The `family` allowlist enforces charter rule "No new brand colours or typefaces without an issue" (`agents/design-specialist.md:90-91`) — if a new family is ever approved, the allowlist is updated in the same PR as the charter change (feature, not annoyance; note it in the error text).
- `node:test` is stdlib — no new dependency (G4).
