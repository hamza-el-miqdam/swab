# SUG-OPS-015 — .dockerignore misses apps/ios & apps/android (build context bloat) and keeps stale entries

- **Area:** devops
- **Topic:** docker
- **Impact:** low
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

The API image builds with the **monorepo root** as context (`docker-compose.yml:30-32`, and `apps/api/Dockerfile:3` documents it). `.dockerignore` covers node_modules/dist/.turbo/docs/etc. (`.dockerignore:1-16`) but NOT:

- `apps/ios/` — full Xcode project, sources, `SwabApp.xcodeproj`, UI test bundles;
- `apps/android/` — including a real on-disk Gradle **`build/`** output directory (verified present: `ls apps/android` shows `build`), which can be hundreds of MB;
- `test-results/` — E2E result bundles (`scripts/e2e-ios.sh:18` writes `test-results/e2e/ios-e2e.xcresult` there; `.xcresult` bundles are large);
- `specs/`, `suggestions/` — never needed in the image.

Every `docker compose up --build` streams all of that to the daemon before the first layer builds — pure wasted time on the daily dev loop, and a cache-buster risk (context checksum changes when any of it changes). Meanwhile `.dockerignore:17` still excludes `apps/mobile` — the Expo RN app removed 2026-07-19 (`CLAUDE.md` header) — and `.dockerignore:8` excludes `.expo`, both dead entries that mislead readers about what exists.

## Implementation plan

1. Edit `.dockerignore`: append the missing exclusions and drop the stale ones. Resulting file (order-insensitive; keep it grouped and commented):
   ```
   node_modules
   **/node_modules
   .turbo
   **/.turbo
   dist
   **/dist
   .next
   coverage
   blueprints
   docs
   agents
   *.md
   .env
   .env.*
   .git
   # native apps never enter the API image (root build context)
   apps/ios
   apps/android
   # local artifacts
   test-results
   specs
   suggestions
   .claude
   .github
   ```
   (Removed: `.expo`, `apps/mobile`. Added: the six new entries. `.claude`/`.github` are config-only, never image inputs.)
2. Verify nothing in `apps/api/Dockerfile` COPYs any newly-excluded path — it copies only root manifests, `packages/db`, `apps/api` (`Dockerfile:21-30`). It doesn't.
3. Root `CHANGELOG.md` entry (one line; low ceremony).

## Tests & acceptance criteria

- Before/after context size: `docker build -f apps/api/Dockerfile .` log line "transferring context" shrinks substantially (with `apps/android/build` present locally, expect a large drop).
- `docker compose up --build` still builds and the API serves `/health`.
- `git grep -n "apps/mobile" .dockerignore` → empty.

## Risks & gotchas

- `*.md` at `.dockerignore:13` already excludes markdown at every level (dockerignore patterns: bare `*.md` matches root only in classic builders, but BuildKit matches recursively for `*.md`? — it does NOT: `*.md` is root-level only; `**/*.md` would be recursive). Don't "fix" that in this PR unless verified — the image builds fine either way; note it and move on.
- If a future web app (`apps/web`) shares this context, keep its exclusion decisions separate; don't preemptively exclude `apps/web`.
