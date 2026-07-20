# SUG-OPS-002 — CODEOWNERS and the scope-guard check promised by G4 do not exist

- **Area:** devops
- **Topic:** security
- **Impact:** high
- **Effort:** M
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G4 workflow rules; devops project rule 3)

## Problem / Opportunity

`agents/_global-directives.md` (G4) states "A PR touching paths outside scope will be auto-rejected by the scope guard" and that `packages/db/prisma/schema.prisma` has exactly ONE writer. The devops agent file mandates: "CODEOWNERS maps `area:*` scopes to path prefixes; the scope-guard check fails PRs whose diff escapes the issue's declared scope" (`agents/devops-infrastructure-specialist.md`, Project Rules #3). `docs/agent-playbook.md:22` lists "scope guard" as Sprint 0 DevOps work, and `docs/STATUS.md:32` confirms it is still missing.

Reality: there is **no CODEOWNERS file anywhere** (checked repo root, `.github/`, `docs/` — `find` returned nothing) and **no scope-guard workflow** (`.github/workflows/` contains only `ci.yml`; `.github/workflows/agents/` is an empty directory). The single most important hard boundary — schema.prisma's single-writer rule — is enforced only by convention today.

## Implementation plan

1. Create `.github/CODEOWNERS` (repo owner is `hamza-el-miqdam`, solo — CODEOWNERS here documents intent and drives review-request routing; real enforcement is step 2):

   ```
   # Fallback
   *                                  @hamza-el-miqdam
   # area:db — single writer (G4)
   /packages/db/prisma/schema.prisma  @hamza-el-miqdam
   # area:sre
   /.github/                          @hamza-el-miqdam
   /turbo.json                        @hamza-el-miqdam
   /apps/api/Dockerfile               @hamza-el-miqdam
   /docker-compose.yml                @hamza-el-miqdam
   ```
2. Create `.github/workflows/scope-guard.yml` — a PR check that maps the PR's `area:*` label to allowed path prefixes and fails if the diff escapes them:

   ```yaml
   name: scope-guard
   on:
     pull_request:
       types: [opened, synchronize, labeled, unlabeled]
   permissions:
     contents: read
     pull-requests: read
   jobs:
     scope:
       runs-on: ubuntu-latest
       timeout-minutes: 5
       steps:
         - uses: actions/checkout@v4
           with: { fetch-depth: 0 }
         - name: Check diff against area scope
           env:
             LABELS: ${{ join(github.event.pull_request.labels.*.name, ' ') }}
             BASE: ${{ github.event.pull_request.base.sha }}
           run: node scripts/scope-guard.mjs
   ```
3. Create `scripts/scope-guard.mjs`: a small Node script with a map `{ "area:ios": ["apps/ios/"], "area:android": ["apps/android/"], "area:backend": ["apps/api/", "packages/api-client/"], "area:db": ["packages/db/"], "area:web": ["apps/web/", "packages/ui/"], "area:design": ["blueprints/", "docs/design/", "docs/design-system.md", "packages/ui/tokens/"], "area:sre": [".github/", "turbo.json", "apps/api/Dockerfile", "docker-compose.yml", "scripts/"], ... }` (derive exact prefixes from each `agents/*-specialist.md` Scope section). Shared always-allowed paths for every area: the area's `CHANGELOG.md`, `docs/STATUS.md`, `docs/qa/**` (per G5/G2 Definition of Done). Run `git diff --name-only $BASE...HEAD`, fail with a clear message listing escaping paths. PRs with no `area:*` label: warn-and-pass initially (flip to fail after a bake-in week).
4. Extra hard gate for the schema: in the same script, if the diff touches `packages/db/prisma/schema.prisma` and the PR lacks label `area:db`, fail unconditionally.
5. Once green on a few PRs, mark `scope-guard` as a required status check in branch protection for `main`.
6. Update `docs/STATUS.md:32` and root `CHANGELOG.md` in the implementing PR.

## Tests & acceptance criteria

- Unit-test `scripts/scope-guard.mjs` path-matching with a table-driven vitest/node test (pure function taking `(labels, changedFiles)`).
- Open a test PR labeled `area:ios` that touches `apps/api/src/…` → check fails; same PR touching only `apps/ios/**` + `apps/ios/CHANGELOG.md` → passes.
- `actionlint` clean.

## Risks & gotchas

- Cross-cutting PRs (e.g. spec + code) will need multiple `area:*` labels — the script should union the allowed prefixes of all labels present.
- Don't make it required in branch protection until the label taxonomy is stable, or every existing open PR goes red.
- `labeled`/`unlabeled` trigger types are required or fixing a wrong label won't re-run the check.
