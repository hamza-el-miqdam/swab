# SUG-OPS-010 — Node version has three diverging sources: CI runs 20, Docker runs 22, no .nvmrc

- **Area:** devops
- **Topic:** dx
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (devops best practice "Node version from `.nvmrc` single source")

## Problem / Opportunity

- CI tests on Node **20**: `.github/workflows/ci.yml:23` (`node-version: 20`).
- The container runs Node **22**: `apps/api/Dockerfile:8` (`FROM node:22-slim`).
- Root constraint is only a floor: `package.json:5-7` (`"engines": { "node": ">=20" }`).
- There is **no `.nvmrc`** (verified: `ls .nvmrc` → not found), although the devops agent rules require "Node version from `.nvmrc` single source" (`agents/devops-infrastructure-specialist.md`, Domain Best Practices).

So the exact runtime that serves the API (22) is never the runtime that runs the test suite (20). Differences are real (V8 behavior, `--experimental` surface, timer/fetch nuances) and this class of drift is invisible until it bites in the container.

## Implementation plan

1. Create `.nvmrc` at repo root containing exactly:
   ```
   22
   ```
   (Match the container major. If pinning tighter, use the current 22.x LTS line, e.g. `22.17` — resolve at implementation time; keep it in sync with the Dockerfile digest chosen in SUG-OPS-008.)
2. Edit `.github/workflows/ci.yml:22-24` to read from it:
   ```yaml
   - uses: actions/setup-node@v4
     with:
       node-version-file: .nvmrc
       cache: pnpm
   ```
3. Tighten `package.json` engines to match reality: `"node": ">=22"` (root `package.json:6`). This is an existing-file edit for the implementing agent, in the same PR, so docs/config can't disagree (G5 "code and docs never disagree on main").
4. Grep for other hardcoded Node versions before closing: `grep -rn "node-version\|node:2" .github apps/api/Dockerfile DEVELOPMENT.md README.md` and align any doc text.
5. Root `CHANGELOG.md` entry calling out the CI runtime bump (other agents should know test behavior may shift 20→22).

## Tests & acceptance criteria

- CI run shows `node --version` → v22.x (add a one-line `node --version` step temporarily or check the setup-node log).
- `pnpm turbo run lint typecheck test build` green on 22 — this is the actual migration test; if anything fails on 22, that is a live bug today (the container already runs 22).
- `nvm use` / `fnm use` in a fresh clone picks 22 from `.nvmrc`.

## Risks & gotchas

- If a test fails on Node 22, do not "fix" it by staying on 20 — the prod container is 22 (`Dockerfile:8`); fix the test/code (route to backend-specialist if in `apps/api/src`).
- `setup-node`'s pnpm cache is keyed independently of Node version; no cache invalidation issues expected.
- Renovate/Dependabot don't bump `.nvmrc` by default — note in the file that it moves together with the Dockerfile base image.
