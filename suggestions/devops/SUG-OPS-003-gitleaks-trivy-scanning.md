# SUG-OPS-003 — gitleaks and Trivy scans mandated by the devops hard constraints are not wired

- **Area:** devops
- **Topic:** security
- **Impact:** high
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G1 zero-trust; devops hard constraints 1–2)

## Problem / Opportunity

`agents/devops-infrastructure-specialist.md` Hard Constraints: (1) "CI runs `gitleaks` on every PR; a leaked-secret finding is a blocking failure" and (2) "`apps/api` image is built on every PR touching it and scanned with **Trivy**; zero HIGH/CRITICAL". Neither exists — `.github/workflows/` contains only `ci.yml` (lint/typecheck/test/build + render check, `ci.yml:25-28`), and the API image is never built in CI. The Dockerfile itself acknowledges the Trivy gate "ships with the CI pipeline issue" (`apps/api/Dockerfile:5-7`) — that issue has not landed. With JWT secrets and DB URLs flowing through env files (`apps/api/.env.example:2-3`), secret-leak scanning is the cheapest high-value gate available.

## Implementation plan

1. Create `.github/workflows/security.yml`:

   ```yaml
   name: security
   on:
     pull_request:
     push:
       branches: [main]
   permissions:
     contents: read
   concurrency:
     group: security-${{ github.ref }}
     cancel-in-progress: true
   jobs:
     gitleaks:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       steps:
         - uses: actions/checkout@v4
           with: { fetch-depth: 0 }   # gitleaks scans history of the PR range
         - uses: gitleaks/gitleaks-action@v2
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
     trivy-api-image:
       runs-on: ubuntu-latest
       timeout-minutes: 20
       steps:
         - uses: actions/checkout@v4
         - name: Build API image
           run: docker build -f apps/api/Dockerfile -t swab-api:pr .
         - name: Trivy scan (blocking on HIGH/CRITICAL)
           uses: aquasecurity/trivy-action@0.28.0
           with:
             image-ref: swab-api:pr
             exit-code: "1"
             severity: HIGH,CRITICAL
             ignore-unfixed: true
   ```
2. Gate `trivy-api-image` to PRs touching the image inputs, per hard constraint 2 ("every PR touching it"): add a `paths` condition via a separate `on.pull_request.paths`-scoped workflow, or an `if:` with `dorny/paths-filter` on `apps/api/**`, `packages/db/**`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`.
3. Add a committed `.gitleaks.toml` only if false positives appear (e.g. the compose local-only `JWT_SECRET: local-dev-only-secret-change-me-0000000000` at `docker-compose.yml:35` and `.env.example` placeholders will likely need an allowlist entry — allowlist by path, with a comment).
4. Note `ignore-unfixed: true` + hard constraint 2's `.trivyignore`-with-expiry convention in the workflow comments so future waivers follow the rule ("never silently").
5. Root `CHANGELOG.md` entry + flip the relevant part of the CI row in `docs/STATUS.md:32`.

## Tests & acceptance criteria

- PR run: both jobs green on a clean branch.
- Negative test: commit a fake AWS key (`AKIA…`) on a scratch branch → gitleaks job fails; drop the commit.
- `docker build` step succeeds from repo root context (it does locally today via compose, `docker-compose.yml:30-32`).
- `actionlint` clean.

## Risks & gotchas

- `gitleaks-action@v2` requires a license key for **organizations**; free for individual accounts — repo is `hamza-el-miqdam/swab` (personal), so free. If it ever moves to an org, budget for the license or switch to running the `gitleaks` binary directly (`gitleaks detect --redact --log-opts=...`).
- The compose dev secret and `.env.example` placeholders may trip the scanner — allowlist deliberately, per-path, not globally.
- Trivy on `node:22-slim` (unpinned, `apps/api/Dockerfile:8`) may fail day one on OS CVEs; pair with SUG-OPS-008 (digest pin) and be ready to bump the base image in the same PR.
