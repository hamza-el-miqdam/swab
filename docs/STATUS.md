# Swab — Implementation Status

> **The single answer to "what is done in this project?"**
> Update this file in the same PR as any change that starts, advances, or completes a module.
> Detail per change lives in the area changelogs (see [Changelogs](#changelogs)); this file stays a summary.

_Last updated: 2026-07-07_

## Modules (functional specs)

| Spec | Module | Status | Lead | Notes |
|---|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 In progress | Backend | API done: phone-OTP auth (`/auth/otp`), JWT sessions, opaque vault store (`/vault`, versioned), `/health` + `/ready`. Mobile vault client done (AES-256-GCM on-device, SecureStore key). **Missing:** contact discovery endpoint, web invite landing. |
| FS-01 | Onboarding | 🟢 Implemented | Mobile | Signup (phone → OTP), contact import + skip path, radial calibration, completion. Test names carry ONB-02/03/04/07/08. Dev-mode OTP returned in API response (no SMS provider yet). |
| FS-02 | Relationship Map | ⚪ Not started | Mobile | Depends on FS-01 ✅, FS-07 🟡. |
| FS-03 | Contact Card | 🟡 In progress | Mobile | Fiche implemented standalone (`app/contact/[id].tsx`, FCH-01..08 tests green); MAP-04 reverse transition + real entry point pending FS-02. |
| FS-04 | Subgroups (FCA) | ⚪ Not started | Mobile | Pure on-device domain module. |
| FS-05 | Envie & Match | ⚪ Not started | Mobile + Backend | The only two-agent spec; OpenAPI seam not yet drafted. |
| FS-06 | Filtering rules | ⚪ Not started | Mobile | Rules live in the vault. |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Implemented (spec acceptance tests green) · 🔵 Hardened (privacy audit passed)

## Platform & infrastructure

| Item | Status | Notes |
|---|---|---|
| Monorepo (Turborepo + pnpm, strict TS) | 🟢 | `apps/mobile`, `apps/api`, `packages/db`. `apps/web`, `packages/ui`, `packages/api-client`, `tools/orchestrator` not created yet. |
| Database schema v0.1 | 🟢 | `users`, `vaults`, `envies` + seed. Privacy invariant holds: no classification columns. |
| Local dev stack | 🟢 | `docker compose up --build` → Postgres :5432, API :3001, Adminer :8080. |
| Mobile dev clients | 🟢 | iOS + Android via `expo run:*` (native crypto → Expo Go unsupported). Android SDK/emulator setup scripted in `scripts/`. |
| CI | 🟡 | `ci.yml` skeleton exists. Missing: scope guard, privacy-audit job, coverage enforcement, OpenAPI diff gate. |
| Lint (repo-wide ESLint) | 🟢 | Flat config: root `eslint.config.mjs` (type-aware typescript-eslint) + Expo preset in `apps/mobile`. All packages run `eslint .` — the mobile `exit 0` stub is gone. |
| Agents (AIDD) | 🟢 | Single source of truth in `agents/`; `node scripts/render-agents.mjs` generates the Copilot (`.github/`) and Claude Code (`.claude/agents/`) copies (`--check` for CI). |
| SMS provider (OTP) | ⚪ | Dev mode returns the code in the response; provider selection is an open question. |
| Privacy audit (playbook §6) | ⚪ | Must run before any external tester and after every schema/API change. |

## Changelogs

Every change lands with an entry in its area changelog (rule G4.7 in `agents/_global-directives.md`):

- [apps/mobile/CHANGELOG.md](../apps/mobile/CHANGELOG.md) — `area:mobile`
- [apps/api/CHANGELOG.md](../apps/api/CHANGELOG.md) — `area:backend`
- [packages/db/CHANGELOG.md](../packages/db/CHANGELOG.md) — `area:db`
- [CHANGELOG.md](../CHANGELOG.md) (repo root) — `area:devops`, docs, agents, tooling, cross-cutting

## How to update this file

- Starting a module → flip it to 🟡 with a one-line note of what's in flight.
- Finishing a module → 🟢 only when the spec's acceptance criteria have green tests; update the spec's `Status:` header to `Implemented` in the same PR.
- 🔵 is set only by a passing privacy audit (playbook §6).
- Keep notes to one or two lines — history belongs in the changelogs, not here.
