# Swab (صواب)

App that connects people with friends: you express an "envie" to a scope; it's revealed only if mutual. Turborepo + pnpm monorepo, strict TypeScript: `apps/mobile` (Expo RN), `apps/web` (Next.js), `apps/api` (Fastify), `packages/db` (Prisma/Postgres), `tools/orchestrator`.

## Binding rules (single source of truth — imported, do not duplicate)

@agents/_global-directives.md

## Where things are

- **What is done:** `docs/STATUS.md` — implementation status per module + infrastructure. Update it in the same PR when a module starts or completes.
- **Change history (G5 — part of every Definition of Done):** every change appends an entry to its area changelog in the same commit/PR — `apps/mobile/CHANGELOG.md`, `apps/api/CHANGELOG.md`, `packages/db/CHANGELOG.md` (data-steward only), root `CHANGELOG.md` (devops/docs/agents/tooling). Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, newest first.
- Functional specs with stable requirement IDs: `docs/specs/FS-01..07-*.md` — read the relevant spec BEFORE implementing; quote requirement IDs (ONB-05, ENV-11…) in branch, PR title, and test names.
- Process (issue protocol, build order, privacy audit): `docs/agent-playbook.md`
- Product laws + glossary (French UI copy is normative): `docs/product-overview.md`
- Data model rationale: `swab-domain-spec.md` · Architecture: `aidd-multi-agent-blueprint.md`
- Specialist role rules: `agents/*.md` — the ONLY place to edit agent behavior. `node scripts/render-agents.mjs` generates the Copilot copies (`.github/`) and the Claude Code subagents (`.claude/agents/` — use them for area work: mobile, web, backend, data, devops, design). Never edit rendered files by hand.

## Spec-driven development (spec-kit)

Swab uses [github/spec-kit](https://github.com/github/spec-kit) to turn specs into implementation plans and tasks. Workflow: `docs/specs/FS-*.md` (source requirements) → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Optional gates: `/speckit-clarify` (before planning, de-risk ambiguity), `/speckit-analyze` (after tasks, before implement, cross-artifact consistency), `/speckit-checklist` (after plan, requirements quality).

- `.specify/memory/constitution.md` is spec-kit's planning-time gate — it mirrors `agents/_global-directives.md`, it does not replace it. **On any conflict, `agents/_global-directives.md` wins.** Amend the global directives first, then re-run `/speckit-constitution` to resync.
- Existing `docs/specs/FS-*.md` files remain the canonical specs for already-scoped work; spec-kit's `/speckit-specify` is for scaffolding new feature specs going forward, not a mandatory migration of old ones.

## Commands

- `pnpm install` — workspace install
- `pnpm turbo run lint typecheck test build` — full gate (CI parity)
- `pnpm --filter @repo/api test` / `pnpm --filter @repo/mobile test` — per-package
- `pnpm --filter @repo/db db:generate` — regenerate Prisma client (build/test depend on it)
- `docker compose up --build` — local Postgres :5432 + API :3001 + Adminer :8080
- Mobile: `cd apps/mobile && npx expo run:ios|android` (dev client required — native crypto module; Expo Go won't work)

## Hard boundaries (will fail review/CI if crossed)

- `packages/db/prisma/schema.prisma`: ONLY the data-steward agent edits it; others open an `area:db` proposal.
- Classification data (rings/rôles/état/ressenti, filter rules, subgroup names) never appears in API payloads, server code, logs, or DB columns — only inside the encrypted vault blob.
- No Vercel-proprietary APIs, no Neon-specific SQL (AWS portability). No new deps without justification in the PR.
- French UI copy comes from specs verbatim. No counters, celebrations, or urgency anywhere.
