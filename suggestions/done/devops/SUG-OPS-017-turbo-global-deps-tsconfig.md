# SUG-OPS-017 — turbo.json globalDependencies omits tsconfig.base.json: stale typecheck/build caches

- **Area:** devops
- **Topic:** caching
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

`turbo.json:3` declares exactly one global hash input: `"globalDependencies": ["eslint.config.mjs"]`. But every workspace package's TypeScript config extends the root base file:

- `apps/api/tsconfig.json:2` — `"extends": "../../tsconfig.base.json"`
- `packages/db/tsconfig.json:2` — same
- `packages/ui/tsconfig.json:2` — same

Turbo hashes files *inside each package directory* plus `globalDependencies`; root-level `tsconfig.base.json` is neither. So changing a compiler flag in `tsconfig.base.json` (e.g. enabling `noUncheckedIndexedAccess`, changing `target`) does **not** invalidate cached `typecheck` or `build` task results (`turbo.json:6-12`). Local runs cache by default today, so a developer flipping a strictness flag can see `FULL TURBO` green while the new flag was never actually checked — and once CI caching lands (SUG-OPS-009), CI inherits the same false-green. The repo advertises "strict TypeScript" as a core property (`CLAUDE.md` header), which makes silent non-enforcement of compiler-flag changes worth closing now, before the CI cache arrives.

## Implementation plan

1. Edit `turbo.json:3`:
   ```json
   "globalDependencies": ["eslint.config.mjs", "tsconfig.base.json"]
   ```
2. Consider (same PR, optional): `.nvmrc` once SUG-OPS-010 creates it — Node version changes task behavior; turbo ≥2 already includes some env/engine inputs, so only add it if verification (step below) shows it isn't hashed.
3. No other file changes. Root `CHANGELOG.md` entry (one line).

## Tests & acceptance criteria

- `pnpm turbo run typecheck` twice → second run fully cached. Touch a comment in `tsconfig.base.json` → third run re-executes typecheck for all three packages (cache MISS). Revert the touch.
- `pnpm turbo run typecheck --dry=json | jq '.tasks[0].inputs' | grep tsconfig.base` style verification: base file present in hashed inputs (exact jq path per turbo version).

## Risks & gotchas

- One-time cache invalidation for everyone on merge (global hash changes) — a single cold run, expected and harmless.
- Do not add broad globs (e.g. `"*.json"`) to globalDependencies — every PR would nuke the whole cache; keep the list surgical.
