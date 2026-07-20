# SUG-OPS-019 — Stale RN-era root config: dead pnpm override and phantom `tools/*` workspace glob

- **Area:** devops
- **Topic:** dx
- **Impact:** low
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

Two leftovers in root workspace config survived the Expo/RN app removal (2026-07-19, `CLAUDE.md` header):

1. **Dead dependency override.** Root `package.json:26-30`:
   ```json
   "pnpm": { "overrides": { "react-native-quick-base64": "2.2.2" } }
   ```
   This pin existed for Expo autolinking in the retired `apps/mobile` (memory/changelog context). Verified: `grep -rn "quick-base64" apps packages` (excluding node_modules) → zero references. A dead override is noise at best; at worst it silently redirects a future transitive dependency nobody expects to be pinned.
2. **Phantom workspace glob.** `pnpm-workspace.yaml:4` includes `"tools/*"` but no `tools/` directory exists (verified: `ls tools` → not found; `docs/STATUS.md:29` confirms `tools/orchestrator` "not created yet"). Harmless to pnpm, but misleading to readers and to tooling that trusts the workspace file as a map of what exists.

Small stuff — but root manifests are the files every agent reads first, and the repo's own rule is that config/docs never lie (`agents/_global-directives.md` G5: "Code and docs never disagree on main").

## Implementation plan

1. Edit root `package.json`: delete the `"pnpm"` block (lines 26-30). Run `pnpm install` to re-resolve; commit the resulting `pnpm-lock.yaml` change (removing an override that nothing references should produce no dependency graph change beyond dropping the override record — verify the diff is trivial).
2. For `pnpm-workspace.yaml:4`, choose one (recommend a):
   a. Keep `tools/*` but add a comment line above it: `# tools/orchestrator planned — not created yet (docs/STATUS.md)`; or
   b. Remove the glob and re-add it when `tools/orchestrator` is created (re-adding is a one-liner; blueprint `aidd-multi-agent-blueprint.md` still names it).
3. Root `CHANGELOG.md` entry (one line, notes the override removal so anyone bisecting a base64-related resolution change finds it).

## Tests & acceptance criteria

- `pnpm install --frozen-lockfile` fails post-edit only until the lockfile is regenerated; after `pnpm install`, `git diff pnpm-lock.yaml` shows only the override removal.
- `pnpm turbo run lint typecheck test build` green (full CI-parity gate per `CLAUDE.md` Commands).
- `grep -rn "quick-base64" package.json pnpm-lock.yaml` → no hits after regen.

## Risks & gotchas

- If the lockfile diff after removing the override is anything but trivial, stop and inspect — it would mean something still resolves `react-native-quick-base64` transitively, and removing the pin changes a real version. (No evidence of that today; the check is cheap insurance.)
- Lockfile regeneration must use the pinned pnpm (`package.json:4`, `pnpm@10.12.1` via corepack) so unrelated lockfile-format churn doesn't pollute the diff.
