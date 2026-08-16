# SUG-DES-003 — Token drift guard (`generate.mjs --check`) is never run in CI

- **Area:** design
- **Topic:** codegen
- **Impact:** high
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md) — the fix lives entirely in `packages/ui/package.json`, inside design scope
- **Related requirement IDs:** n/a

## Problem / Opportunity

The generator has a `--check` mode advertised as "exit 1 if renders are stale (CI)" (`packages/ui/scripts/generate.mjs:15`, `:391-395`, `:402-407`), and `docs/design-system.md:137-138` says "`--check` for CI drift — the same convention as `scripts/render-agents.mjs`". But CI only wires the agent-render check: `.github/workflows/ci.yml:25-26` runs `node scripts/render-agents.mjs --check`; nothing runs the token check. `packages/ui/package.json:12-16` has only `generate`, `lint`, `typecheck` scripts — no `test` — so `pnpm turbo run lint typecheck test build` (`ci.yml:28`) never exercises it either. Today someone can hand-edit `DesignTokens.swift`/`DesignTokens.kt`/`tokens.ts` or edit `tokens.json` without regenerating, and CI stays green — exactly the drift the SSOT was built to prevent.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/packages/ui/package.json`, add a test script (the `test` task already exists in `turbo.json` and CI already runs it):

   ```json
   "scripts": {
     "generate": "node scripts/generate.mjs",
     "generate:check": "node scripts/generate.mjs --check",
     "test": "node scripts/generate.mjs --check",
     "lint": "eslint .",
     "typecheck": "tsc --noEmit"
   }
   ```

2. Verify locally: `pnpm --filter @repo/ui test` → "Design tokens up to date." Then hand-touch a generated file, re-run, confirm exit 1 with `STALE: ...`, revert.
3. Root `CHANGELOG.md` entry (area:design). Optionally note in `docs/design-system.md` §5 that the check runs via `pnpm turbo run test`.
4. (Optional follow-up for devops-specialist, separate issue: a named CI step `node packages/ui/scripts/generate.mjs --check` next to the render-agents step in `.github/workflows/ci.yml` for a clearer failure message — design-specialist must NOT edit workflows, `agents/design-specialist.md:20`.)

## Tests & acceptance criteria

- `pnpm turbo run test` fails when any of the four generated outputs (`generate.mjs:375-383`) is stale or hand-edited, passes otherwise.
- CI run on a PR that edits `tokens.json` without regenerating goes red.

## Risks & gotchas

- `generate.mjs --check` only reads files; it touches `apps/ios`/`apps/android` paths read-only, so running it from the pnpm workspace is safe even though the native apps are outside the turbo pipeline (`docs/STATUS.md` Platform table, Monorepo row).
- When a real test runner is later added to `packages/ui`, keep the drift check chained (e.g. `"test": "node scripts/generate.mjs --check && vitest run"`).
