# SUG-OPS-004 — No Dependabot/Renovate: dependencies and action pins never get freshness PRs

- **Area:** devops
- **Topic:** security
- **Impact:** high
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G1; devops best practice "Dependabot/Renovate keeps pins fresh")

## Problem / Opportunity

`.github/` contains only `copilot-instructions.md`, `instructions/`, and `workflows/` — there is no `dependabot.yml` and no `renovate.json` anywhere in the repo. The devops agent's own best-practices section requires "third-party actions pinned to full commit SHAs (not tags); Dependabot/Renovate keeps pins fresh" (`agents/devops-infrastructure-specialist.md`). Four ecosystems currently drift silently: npm/pnpm (root `package.json:17-25` uses caret ranges), GitHub Actions (`ci.yml:19-21`), Gradle (`apps/android/build.gradle.kts:5-7`, Kotlin 2.0.21 hardcoded), and Docker (`apps/api/Dockerfile:8` `node:22-slim`, `docker-compose.yml:14` `postgres:17`, `docker-compose.yml:59` `adminer:5`). Security patches (fastify, prisma, zod at `apps/api/package.json`) arrive only when someone remembers.

## Implementation plan

1. Create `.github/dependabot.yml`:

   ```yaml
   version: 2
   updates:
     - package-ecosystem: npm
       directory: /
       schedule: { interval: weekly, day: monday }
       open-pull-requests-limit: 5
       groups:
         npm-minor-patch:
           update-types: [minor, patch]
     - package-ecosystem: github-actions
       directory: /
       schedule: { interval: weekly }
     - package-ecosystem: gradle
       directory: /apps/android
       schedule: { interval: weekly }
       open-pull-requests-limit: 3
     - package-ecosystem: docker
       directory: /apps/api
       schedule: { interval: weekly }
     - package-ecosystem: docker-compose
       directory: /
       schedule: { interval: weekly }
   ```
2. Keep the grouping (`npm-minor-patch`) — solo maintainer, free-tier CI budget (devops project rule 1): one grouped PR/week instead of ten. Major bumps stay individual PRs.
3. Preserve the deliberate pin: root `package.json:27-29` overrides `react-native-quick-base64: 2.2.2` (memory note: pinned for Expo autolinking; the RN app is gone but the override remains) — add an `ignore:` entry for it or, better, flag it for removal to the owner since `apps/mobile` no longer exists (do not remove it in this PR; propose separately).
4. Labels: add `labels: ["deps"]` per ecosystem so scope-guard (SUG-OPS-002) can allow Dependabot PRs (they touch lockfiles across packages).
5. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- After merge, GitHub's "Dependency graph → Dependabot" tab shows all five update configs with no config-parse errors.
- First scheduled run opens grouped PRs; CI (`ci.yml`) runs on them (Dependabot PRs get read-only `GITHUB_TOKEN` — fine, CI only needs `contents: read`, `ci.yml:8-9`).
- `docker-compose` ecosystem picks up `postgres:17` / `adminer:5` from `docker-compose.yml`.

## Risks & gotchas

- Dependabot npm support for pnpm workspaces + catalogs is solid on lockfile v9; repo uses `pnpm@10.12.1` (`package.json:4`) — if updates fail to rebase the lockfile, switch that ecosystem to Renovate (better pnpm support) and keep Dependabot for actions/docker/gradle.
- Gradle updates for plugin versions declared in `build.gradle.kts` `plugins {}` blocks are supported, but AGP/Kotlin/Compose must move in compatible lockstep — route those PRs to the android-specialist for review rather than auto-merging.
- Weekly cadence + grouping chosen to protect free-tier Actions minutes; don't set `interval: daily`.
