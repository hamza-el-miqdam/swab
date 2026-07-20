# Swab — Agent Playbook

How the AI agents (and their human) turn the functional specs into shipped code. This document is operational: the orchestrator and the agent prompts assume it. Your persona file in `/agents` defines WHO you are; this defines HOW work flows.

## 1. Ownership matrix

| Spec | Lead agent | Supporting | Key seam |
|---|---|---|---|
| FS-01 Onboarding | iOS + Android | Backend (OTP) | `POST /auth/otp`, `POST /vault` |
| FS-02 Relationship Map | iOS + Android | — | vault read only |
| FS-03 Contact Card | iOS + Android | — | vault read/write only |
| FS-04 Subgroups | iOS + Android | — | pure domain module, vault |
| FS-05 Envie & Match | iOS + Android + Backend | Data (constraints) | `POST /envies` contract (OpenAPI normative) |
| FS-06 Filtering | iOS + Android | — | pure domain module, vault |
| FS-07 Identity & Vault | Backend | iOS + Android, Data, Web | auth + vault + discovery endpoints |
| Schema (all) | **Data Steward — exclusive** | proposals from Backend | `area:db` issues |
| CI/CD (all) | DevOps | — | required checks |

*"iOS + Android" means the same requirement is implemented per-platform by ios-specialist and android-specialist, each gated by its own E2E suite (G2).*

## 2. Build order (pipeline stages, from the blueprint)

```
Sprint 0  DevOps: CI skeleton, Neon GC, migrate-prod.yml, scope guard
Sprint 1  Data: schema v0.1 migration ──► Backend: FS-07 (auth, vault, discovery)
Sprint 2  iOS + Android: FS-01 onboarding + FS-02 map (offline core)   [parallel] Web: FS-07 invite landing
Sprint 3  iOS + Android: FS-03 fiche + FS-06 filtering + FS-04 FCA     [parallel] Backend: FS-05 matching engine
Sprint 4  iOS + Android + Backend: FS-05 end-to-end · hardening · privacy audit (§6)
```
Rule: a spec's Depends-on list must be `Implemented` (or explicitly stubbed by agreement in the issue) before its issues are assigned.

## 3. Issue protocol (the orchestrator creates these; agents consume them)

Every issue carries: title `[FS-05][ENV-09] Race-safe match creation`, labels `area:*` + `fs:*`, body sections **Requirement** (verbatim quote of the FR row), **Scope** (allowed paths — the scope guard enforces this), **Acceptance** (the Given/When/Then that must become tests), **Seam** (API contract touched, if any). For `area:ios`/`area:android` issues touching user-facing behavior, Acceptance also names the requirement IDs whose E2E scenarios (`docs/qa/e2e-scenarios.md`) must be added or re-run. An issue referencing no requirement ID is invalid — reject it and say why.

## 4. Non-negotiable working rules (compressed from /agents — full text is your prompt)

1. Requirement ID appears in: branch name, PR title, and at least one test name. That's the traceability chain CI greps for.
2. TDD: the acceptance criteria of your issue become failing tests BEFORE implementation. 80% coverage on changed packages.
3. Stay in scope; schema is Data Steward's alone; API contract changes require the OpenAPI diff gate green + regenerated client in the same PR.
4. The five product laws (product-overview §2) override any technical preference. When a spec and a law seem to conflict, stop and comment on the issue.
5. UI copy comes from the blueprints/specs verbatim — never invent or "improve" French copy; missing copy is an issue comment, not an improvisation.
6. ⚠️ ASSUMPTION-marked items are buildable defaults — build them, but structure code so the alternative isn't a rewrite (e.g., match compatibility behind a `MatchPolicy` interface).

## 5. Definition of Ready / Done (gate checklist)

**Ready:** requirement ID exists in an Approved spec · dependencies Implemented or stubbed · seam contract agreed (if cross-agent) · acceptance criteria present.
**Done:** acceptance tests green · coverage ≥80% changed · scope guard green · **mobile E2E gate green (`scripts/e2e-ios.sh` / `scripts/e2e-android.sh` → `test-results/e2e/e2e-report.md` PASS, no drift; summary pasted in the PR — see G2)** · spec status updated if the module completed · required checks (per agent DoD) green · PR ≤400 lines · human review passed.

## 6. The privacy audit (recurring, blocking)

Before any external tester touches a build, and after every schema or API change, run the standing audit — it operationalizes product law 4:

1. **DB audit:** dump a seeded database; verify no table/column reveals rings, tags, rules, subgroup names, or scope names (FS-07 acceptance 2).
2. **Wire audit:** record all app traffic through a full user journey; verify classification data appears only inside `POST /vault` opaque bytes (ONB-05, FCH-01, SGR-07, FLT-06).
3. **Log audit:** grep structured logs for verbs, recipient lists, phone hashes, tokens (G3 forbidden list) — zero hits.
4. **Non-observability audit:** the ENV-11 and ENV-15 tests (non-match invisibility, silent pass) pass with response-shape equality.

The DevOps agent (area:sre) wires 1–3 as a CI job (`privacy-audit.yml`); 4 lives in the backend integration suite. A red privacy audit blocks all merges, in every area, until resolved.

## 7. Escalation & communication

- Cross-agent contract change → issue on the seam (OpenAPI PR) tagged both areas; never a unilateral change.
- Ambiguity or spec/law conflict → comment on the issue, tag the Architect (human review in Antigravity Manager), stop work on that thread; pick up another Ready issue meanwhile.
- New assumption needed to proceed → propose it in the issue as `⚠️ PROPOSED ASSUMPTION`, wait for approval; if approved it gets added to product-overview §6 in the same PR.
- Every open question (`OQ-*`) in the specs is tracked as a `question` issue owned by the Architect — agents never resolve OQs implicitly through code.
