# AIDD Multi-Agent Architecture Blueprint

**Stack:** TypeScript · Turborepo · Next.js (web) · Expo/React Native (mobile) · Node.js API · Prisma · Neon Postgres · Vercel
**AI Tooling:** Google Antigravity 2.0 + GitHub Copilot (coding agent + CLI)
**Date:** 2026-07-04

---

## 1. Architecture Self-Critique

Before committing to an orchestration model, here is the honest trade-off analysis for this specific monorepo.

**Event-driven agent model**

Pros: matches how your two tools actually work. Copilot's coding agent is natively event-driven — you assign an issue, it boots a GitHub Actions VM, and emits a draft PR. Vercel and Neon are also event-driven (push → preview deploy → DB branch webhook). An event model lets web, mobile, and API agents run in parallel, which is where multi-agent throughput comes from.

Cons: you inherit distributed-systems problems on day one — idempotency, event ordering, and no transactionality across agents. The worst failure mode for this stack: two agents concurrently mutating `schema.prisma` produces migration conflicts that are expensive to untangle on Neon. Debugging "why did agent X fire" is much harder than reading a sequential log. A true event bus (queue/broker) is over-engineering for a solo/small-team project.

**Sequential worker model**

Pros: deterministic, auditable, trivially debuggable — ideal for your hallucination-guard requirement because every stage output can be verified before the next stage consumes it. The Prisma schema becomes a natural serialization point: schema changes happen in one stage, so no migration races.

Cons: wastes your licenses. Copilot coding agent can run multiple issues in parallel; Antigravity's Manager surface exists specifically to orchestrate parallel agents. A strict pipeline makes the mobile agent wait on the web agent for no reason. Latency compounds: a 5-stage sequential loop at ~10 min/stage means ~1 hr per feature.

**Verdict: stage-gated hybrid, with git as the event bus.**
Use a sequential pipeline at the *stage* level (Spec → Schema → Implement → Verify → Deploy) with event-driven *fan-out inside* the Implement and Verify stages. Critically, don't build a message broker — **the git repo is the bus**. Issues, PRs, labels, and check-runs are the events; both Antigravity and Copilot already speak this protocol natively. The Schema stage is deliberately sequential (single-writer on `schema.prisma`); feature stages fan out in parallel because they only consume the generated Prisma client, never write the schema. This gives ~80% of event-driven throughput with sequential-model debuggability — the right trade for a DevOps-background operator who will live in the CI logs.

---

## 2. Agent Roles & Tool Mapping

| Agent Name | Core Objective | Antigravity Hook | Copilot Hook | Context Scope |
|---|---|---|---|---|
| **Architect (Spec Agent)** | Decompose features into typed contracts (API routes, Zod schemas, acceptance criteria); emit machine-readable specs as GitHub issues | Manager surface planning agent; produces **Artifacts** (implementation plans, task lists) you approve before code exists | Not used for generation; `gh` CLI creates the labeled issues it outputs | Read-only over whole repo; writes only `/docs/specs/*.md` + issue bodies |
| **Data Agent (Schema Steward)** | Sole owner of `packages/db`: Prisma schema evolution, migrations, seed data, Neon branch hygiene | Editor-view agent for interactive schema design with plan Artifact review | Coding agent assigned `area:db` issues; PR limited to `packages/db/**` via CODEOWNERS | `packages/db` only; env-scoped Neon branch connection string — **never production** |
| **Web Feature Agent** | Implement Next.js features against the generated Prisma client + spec contracts | Parallel Manager-surface agents, one per feature, each in its own workspace/worktree | Coding agent assigned `area:web` issues → draft PRs; Copilot code review on every PR | `apps/web`, `packages/ui`, `packages/api-client`; reads specs, never touches `schema.prisma` |
| **Mobile Feature Agent** | Implement Expo/React Native screens sharing the same typed contracts | Same pattern, separate workspace to avoid file-lock contention | Coding agent assigned `area:mobile` issues | `apps/mobile` + shared packages |
| **SRE/Release Agent** | Own CI, e2e tests, Vercel preview/prod deploys, Neon preview-branch lifecycle, rollback | Browser-use verification: records **screenshots/browser recordings as Artifacts** against the Vercel preview URL | Copilot CLI (autopilot mode) inside GitHub Actions steps for self-healing CI failures | `.github/workflows`, `turbo.json`, `e2e/`, Vercel + Neon CLIs with scoped tokens |

3–5 agents is the ceiling on purpose: each additional agent multiplies coordination cost, and the CODEOWNERS-enforced scopes above are what prevent the schema-conflict failure mode from §1.

---

## 3. AIDD Workflow Integration (SDLC loop)

**Stage 0 — Spec.** You describe the feature to the Architect agent in Antigravity's Manager surface. It returns a plan Artifact: typed contracts, file-level task breakdown, acceptance criteria. You approve/edit the Artifact — this is the primary human gate and your cheapest hallucination filter.

**Stage 1 — Schema (sequential gate).** If the spec touches data, the Data Agent gets exactly one issue. It branches, edits `schema.prisma`, runs `prisma migrate dev` against a dedicated Neon development branch, opens a PR. CI runs `prisma validate` + `prisma migrate diff` against a fresh Neon branch to prove the migration applies cleanly. Merge before fan-out — every downstream agent then consumes one regenerated Prisma client.

**Stage 2 — Implement (parallel fan-out).** The orchestrator script labels the remaining spec issues (`area:web`, `area:mobile`, `area:api`) and assigns them to the Copilot coding agent via the GitHub API; simultaneously you can spawn Antigravity agents on the same issues in separate workspaces for the pieces needing more design judgment. Each produces a draft PR. Git is the bus: no agent talks to another directly; they communicate via merged contracts in `packages/*`.

**Stage 3 — Verify.** Every PR triggers: Turborepo-cached `lint → typecheck → test → build`; Vercel preview deploy; Neon branch-per-preview (isolated DB per PR); Playwright e2e against the preview URL. The SRE agent triages red CI (Copilot CLI can be invoked on the failure log); Antigravity's browser agent records a walkthrough Artifact of the preview deployment for visual verification.

**Stage 4 — Deploy.** Human review + green checks → squash-merge → main pipeline runs `prisma migrate deploy` against production Neon (the only place prod credentials exist), then Vercel production deploy. Expo mobile releases ride EAS Update on the same merge trigger.

**Iteration loop:** review comments on a draft PR are themselves events — the Copilot coding agent responds to PR feedback and pushes fixes to the same branch, so the loop tightens without re-orchestration.

---

## 4. Orchestration Strategy

Antigravity has **no public headless automation API** — it's human-orchestrated by design — while Copilot is fully API-drivable (issue assignment, PR events). So the orchestrator's job is: drive Copilot programmatically, and *prepare perfect context* for Antigravity sessions that you launch manually. Custom Node/TS scripts live in `tools/orchestrator`, and the shared context lives in files both tools read: `AGENTS.md` / `.github/copilot-instructions.md` (Copilot) and Antigravity rules/memory, generated from one source of truth so the two toolchains never drift.

Per your context-protection constraint, here is the structural pseudo-code, followed by complete `package.json` configs.

### Orchestrator pseudo-code layout

```
tools/orchestrator/src/
├── index.ts                 # CLI entry: `orchestrate <command>` (commander)
│
├── pipeline.ts              # Stage-gated state machine
│     states: SPEC → SCHEMA → IMPLEMENT → VERIFY → DEPLOY
│     transition(state) requires gate(state).passed
│     persisted as .aidd/pipeline-state.json (committed = auditable)
│
├── stages/
│   ├── spec.ts              # parse approved Artifact (docs/specs/*.md)
│   │                        #   → emit typed IssueSpec[] {title, body, area, scope[]}
│   ├── schema.ts            # if spec.touchesData:
│   │                        #   createIssue(area:db); assignToCopilot(issue)
│   │                        #   await prCheck('prisma-validate','migrate-diff')
│   │                        #   BLOCK fan-out until merged        ← single-writer gate
│   ├── implement.ts         # for each remaining IssueSpec (parallel):
│   │                        #   createIssue(area:*); assignToCopilot(issue)
│   │                        #   OR writeContextPack(.aidd/context/<issue>.md)
│   │                        #      → surfaced to you to launch an Antigravity agent
│   ├── verify.ts            # poll PR check-runs (octokit)
│   │                        #   on failure: attach failure log to PR comment
│   │                        #   verify preview URL 200 + neon branch exists
│   └── deploy.ts            # gate: all PRs merged + main green
│                            #   → tag release; migrations run in CI, not here
│
├── adapters/
│   ├── github.ts            # octokit: createIssue, assignToCopilotAgent,
│   │                        #   listCheckRuns, onPrEvent (webhook or poll)
│   ├── neon.ts              # wraps `neonctl`: ensureBranch, connectionString,
│   │                        #   deleteBranch (preview GC)
│   ├── vercel.ts            # wraps `vercel` CLI: previewUrlFor(branch), envPull
│   └── contextpack.ts       # ONE source of truth → renders both
│                            #   .github/copilot-instructions.md and
│                            #   Antigravity rules file  ← anti-drift bridge
│
└── guards/
    ├── scope.ts             # validate PR diff paths ⊆ IssueSpec.scope (CODEOWNERS++)
    └── hallucination.ts     # run `prisma validate`, `tsc --noEmit`, `next build`
                             #   on agent output BEFORE requesting human review
```

### Root `package.json`

```json
{
  "name": "aidd-monorepo",
  "private": true,
  "packageManager": "pnpm@10.12.1",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "db:generate": "turbo run db:generate",
    "db:migrate": "pnpm --filter @repo/db db:migrate",
    "orchestrate": "pnpm --filter @repo/orchestrator start"
  },
  "devDependencies": {
    "prettier": "^3.5.0",
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  }
}
```

### `packages/db/package.json`

```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:validate": "prisma validate"
  },
  "dependencies": { "@prisma/client": "^6.10.0" },
  "devDependencies": { "prisma": "^6.10.0" }
}
```

### `tools/orchestrator/package.json`

```json
{
  "name": "@repo/orchestrator",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "octokit": "^4.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}
```

### `turbo.json` (critical: Prisma task dependency)

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "db:generate": { "cache": false },
    "build": {
      "dependsOn": ["^build", "^db:generate"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "dependsOn": ["^db:generate"], "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^db:generate"] },
    "test": { "dependsOn": ["^db:generate"] }
  }
}
```

`dev`/`build`/`typecheck` depending on `^db:generate` is the documented Prisma+Turborepo pattern and prevents the classic "stale Prisma client" agent failure.

---

## 5. Actionable Steps & Verification

Prereqs: Node ≥ 20, pnpm, git, a GitHub repo with Copilot enabled, Neon + Vercel accounts.

| # | Step | Command(s) | Verification Command |
|---|---|---|---|
| 1 | Toolchain sanity | — | `node --version && pnpm --version && git --version` |
| 2 | Scaffold Turborepo | `pnpm dlx create-turbo@latest aidd-app` (choose pnpm) | `cd aidd-app && pnpm turbo run build --dry-run` |
| 3 | Add Expo mobile app | `pnpm create expo-app@latest apps/mobile` | `cd apps/mobile && npx expo-doctor` |
| 4 | Create db package | `mkdir -p packages/db && cd packages/db && pnpm init` then `pnpm add -D prisma && pnpm add @prisma/client` | `pnpm ls prisma @prisma/client` |
| 5 | Init Prisma | in `packages/db`: `npx prisma init --datasource-provider postgresql` | `npx prisma validate` (after setting `DATABASE_URL`) |
| 6 | Neon CLI + auth | `npm install -g neonctl && neonctl auth` | `neonctl me` |
| 7 | Create dev DB branch | `neonctl branches create --name dev/agents` | `neonctl branches list` |
| 8 | Get connection string → `.env` | `neonctl connection-string dev/agents` | `npx prisma db pull` (connects OK even with empty schema → expected "introspected 0 models" is fine) |
| 9 | First migration | in `packages/db`: `npx prisma migrate dev --name init` | `npx prisma migrate status` |
| 10 | Vercel link | `npm install -g vercel && vercel login && vercel link` | `vercel whoami && vercel env ls` |
| 11 | Pull Vercel envs | `vercel env pull .env.local` | `cat .env.local \| grep -c "="` (non-zero) |
| 12 | GitHub remote + Copilot | `gh auth login && gh repo create aidd-app --private --source=. --push` | `gh repo view --json name,visibility` |
| 13 | Copilot CLI | `npm install -g @github/copilot` | `copilot --version` |
| 14 | Orchestrator skeleton | `mkdir -p tools/orchestrator/src && cd tools/orchestrator && pnpm init && pnpm add octokit zod commander && pnpm add -D tsx typescript` | `pnpm tsx --version` |
| 15 | Shared agent context | create `AGENTS.md` + `.github/copilot-instructions.md` (generated by `contextpack.ts`) | `test -f AGENTS.md && test -f .github/copilot-instructions.md && echo OK` |
| 16 | Full pipeline check | `pnpm turbo run lint typecheck build` | exit code 0; `pnpm turbo run build` again → look for `FULL TURBO` (cache hit) |

Notes kept deliberately conservative per your hallucination guard: `prisma init --datasource-provider postgresql`, `prisma migrate dev/deploy/status/validate`, `create-turbo@latest`, `create-expo-app@latest`, `neonctl auth/me/branches/connection-string`, and `vercel link/env pull/whoami` are all current documented commands. Anything version-sensitive (exact wizard prompts, flag defaults) I've avoided pinning.

**Vercel monorepo config:** in the Vercel dashboard set the project Root Directory to `apps/web`; the Neon↔Vercel native integration then creates a Neon branch per preview deployment automatically — prefer that managed integration over hand-rolled webhook code.

---

## 6. Known Limitations: Bridging Copilot ↔ Antigravity

**No shared memory or context plane.** The two systems cannot read each other's session state. Copilot's coding agent gets context from the repo + issue body + `.github/copilot-instructions.md`/`AGENTS.md`; Antigravity from its workspace, rules, and memory. The only durable bridge is *files in the repo* — hence the `contextpack.ts` generator. Anything not committed is invisible to the other tool.

**No public Antigravity automation API.** The Manager surface is human-driven; you cannot programmatically spawn Antigravity agents from the orchestrator the way you assign issues to Copilot via the GitHub API. Antigravity stages are therefore semi-automated: the orchestrator prepares context packs, you click "launch." Budget for this asymmetry — fully autonomous paths should route through Copilot.

**Artifact format lock-in.** Antigravity Artifacts (plans, browser recordings) don't export to a format Copilot consumes. Mitigation: have Antigravity agents write plans into `docs/specs/*.md` in the repo, not just Artifacts.

**Context-window and rate budgets differ.** Copilot coding agent sessions are bounded by GitHub Actions time + premium-request quotas; Antigravity is bounded by Gemini model quotas. Long-running monorepo-wide tasks can silently truncate context — this is why every agent has a narrow Context Scope in §2 rather than repo-wide access.

**API boundary friction.** Copilot events surface as GitHub webhooks/check-runs (pollable, scriptable); Antigravity progress surfaces only in its UI. The orchestrator's `verify.ts` can gate on Copilot output automatically but must gate on Antigravity output via git commits appearing — an indirect, slower signal.

**Concurrency hazards remain human problems.** Neither tool coordinates with the other on file locks. The CODEOWNERS scopes + single-writer schema stage are the mitigation, not a guarantee — expect occasional rebase conflicts when both toolchains touch shared `packages/*`.

**Model disagreement.** Gemini (Antigravity) and Copilot's models will make different idiomatic choices (e.g., error-handling patterns). Pin conventions aggressively in the shared context files or the codebase will drift stylistically.

---

## 7. Feedback Loop — ANSWERED 2026-07-04 (see §8 for resulting decisions)

1. **Neon migration execution boundary:** When `prisma migrate deploy` runs against production, where must it execute under your constraints — a GitHub Actions job with a repo-scoped `DATABASE_URL` secret, or inside Vercel's build step? Vercel builds are a poor place for migrations (multiple concurrent builds can race, and rollback semantics are unclear), but some teams are restricted from adding CI secrets. Do you have any policy constraints on where production DB credentials may live (GitHub secrets vs Vercel env vars vs an external secrets manager), and do you require migration runs to be manually approved (GitHub environment protection rules) or fully automatic on merge to main?

2. **Preview-branch lifecycle and data policy:** For the Neon branch-per-PR flow — are preview branches allowed to be created from a copy of production data (fast, realistic e2e, but a compliance risk if prod contains PII), or must they be seeded synthetically from `prisma db seed`? And what's your retention constraint: should the SRE agent delete Neon branches on PR close (keeps you inside Neon's branch/storage limits on lower tiers), or do you need branches retained for post-merge forensic debugging? Your answer determines whether I wire the managed Vercel↔Neon integration (opinionated, auto-cleanup) or custom GitHub Actions using `neonctl` (full control, more code to own).

---

## 8. Deployment Decisions (locked 2026-07-04)

Hamza's answers: DB deployment must be independent of Vercel; both Vercel and Neon will be migrated to AWS once real users arrive; stay on free tiers until then. Backend = separate Node service (chosen via Q&A).

### 8.1 Migration execution boundary — GitHub Actions, never Vercel

`prisma migrate deploy` runs exclusively in a GitHub Actions job on push to `main`, using a `DATABASE_URL` stored as a **GitHub environment secret** (environment: `production`, with a protection rule requiring manual approval on migration jobs). Vercel receives only a *runtime* `DATABASE_URL` env var and never runs migrations in its build step. This is exactly the decoupling needed for the AWS move: the day you switch, the Actions job points at RDS/Aurora and Vercel is untouched (or gone).

```yaml
# .github/workflows/migrate-prod.yml (shape)
on: { push: { branches: [main], paths: ['packages/db/prisma/migrations/**'] } }
jobs:
  migrate:
    environment: production        # ← protection rule = manual approval gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @repo/db db:deploy
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
```

### 8.2 Portability guardrails (agents must enforce these — add to shared context files)

- **API**: `apps/api` is a standalone Fastify/Hono service with a `Dockerfile` from day one. Deployed on Vercel for the POC, but container-ready → ECS/Fargate is a redeploy, not a rewrite. Next.js stays a pure frontend.
- **No Vercel-proprietary APIs** in business logic: no Vercel KV/Blob/Edge Config, no `waitUntil`, no edge-runtime-only code paths.
- **No Neon-proprietary SQL/features** in app code — Prisma + vanilla Postgres only. Neon branching stays a *CI concern* (adapters/neon.ts), never a runtime concern.
- **Scheduled jobs live in GitHub Actions cron, not Vercel cron** (Hobby caps crons at daily/hourly anyway). Actions cron → EventBridge later is trivial.
- e2e tests target a `BASE_URL` env var, never hardcoded `*.vercel.app`.

### 8.3 Free-tier budget constraints (SRE agent's operating envelope)

| Constraint | Limit (verified July 2026) | Consequence for the pipeline |
|---|---|---|
| Neon Free compute | 100 CU-hours/project/month | Preview branches must scale-to-zero; e2e suites kept short |
| Neon Free storage | 0.5 GB/project | Synthetic seed data only (`prisma db seed`), no prod copies — this also answers §7 Q2 |
| Neon Free branches | 10 per project | **Branch-per-PR with aggressive GC**: SRE agent deletes the Neon branch on PR close (`neonctl branches delete`). If >8 concurrent PRs, fall back to one shared `preview` branch |
| Vercel Hobby usage | 100K function invocations, 100 GB bandwidth/mo | Fine for POC; watch it once testers arrive |
| Vercel Hobby terms | **Non-commercial use only** | Acceptable pre-revenue POC; upgrade to Pro (or land on AWS) before any monetization |
| Vercel Hobby cron | Daily granularity | Envie-expiry sweeps run in Actions cron, not Vercel cron |

### 8.4 Impact on the orchestrator

`adapters/neon.ts` gains `gcBranch(prNumber)` wired to the PR-closed webhook; `stages/deploy.ts` gates on the environment-protection approval instead of auto-deploying; `guards/scope.ts` adds a portability lint (greps diffs for `@vercel/kv`, `@vercel/blob`, `neon(` imports in `apps/**` and fails the check-run).

---

### Sources

- [Google Developers Blog — Build with Google Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Google I/O 2026 developer highlights (Antigravity 2.0)](https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/)
- [Introducing Google Antigravity](https://antigravity.google/blog/introducing-google-antigravity)
- [GitHub Docs — About Copilot coding agent](https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent)
- [GitHub Blog — Assigning and completing issues with coding agent](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/)
- [Prisma Docs — Prisma ORM with Turborepo](https://www.prisma.io/docs/guides/turborepo)
- [Turborepo Docs — Prisma guide](https://turbo.build/repo/docs/guides/tools/prisma)
- [Neon Docs — Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration)
- [Neon Blog — Branch per preview deployment](https://neon.com/blog/neon-vercel-native-integration)
- [Neon Docs — Manage branches](https://neon.com/docs/manage/branches)
