# SUG-OPS-006 — Design-token drift guard (`generate.mjs --check`) exists but is not run in CI

- **Area:** devops
- **Topic:** ci
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (design-token SSOT, root CHANGELOG 2026-07-19 entries)

## Problem / Opportunity

The design-token SSOT landed 2026-07-19: `packages/ui/tokens/tokens.json` generates `packages/ui/src/tokens.{ts,css}` plus `apps/ios/.../Generated/DesignTokens.swift` and `apps/android/.../ui/theme/DesignTokens.kt`. The generator explicitly supports a CI drift mode — `packages/ui/scripts/generate.mjs:15`: "`node packages/ui/scripts/generate.mjs --check   # exit 1 if renders are stale (CI)`" (flag parsed at `generate.mjs:23`; verified locally: `--check` exits 0 today). `docs/STATUS.md` (design-system row) also says "`--check` for CI".

But `.github/workflows/ci.yml` runs only the *agent* render check (`ci.yml:25-26`, `render-agents.mjs --check`) — the token check is absent. Both native themes now consume the generated files (commits `23e26bd`, `cfbbcd5`), so a hand-edit to `DesignTokens.swift`/`.kt` or a `tokens.json` change without regeneration merges silently and the three platforms drift — exactly the failure mode the SSOT was built to prevent.

## Implementation plan

1. Edit `.github/workflows/ci.yml`, add one step right after the agent-render check (before `pnpm install` — the generator uses only `node:` built-ins, same as `render-agents.mjs` which already runs pre-install at `ci.yml:26`; verify with `node packages/ui/scripts/generate.mjs --check` on a clean checkout without `node_modules`, and if it does need deps, move it after `pnpm install --frozen-lockfile`):

   ```yaml
   - name: Design tokens in sync (packages/ui/tokens/tokens.json is the source of truth)
     run: node packages/ui/scripts/generate.mjs --check
   ```
2. That's the whole change. Root `CHANGELOG.md` entry noting the new blocking check so ios/android/design agents know regeneration is CI-enforced.

## Tests & acceptance criteria

- CI green on an untouched branch.
- Negative test: edit one hex value in `apps/android/.../ui/theme/DesignTokens.kt` on a scratch branch → the step exits 1 and names the stale file; revert.
- `actionlint` clean.

## Risks & gotchas

- If a legitimate token change is in flight on another branch, this check lands green — it only compares tokens.json against generated outputs in the same tree; no cross-branch coordination needed.
- Keep the step before the (long) turbo step so drift fails in seconds, not minutes.
