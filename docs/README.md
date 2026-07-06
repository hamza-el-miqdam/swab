# Swab — Project Documentation

| Doc | Purpose | Primary readers |
|---|---|---|
| [STATUS.md](./STATUS.md) | **What is done** — module + infra implementation status | Everyone — the project dashboard |
| [product-overview.md](./product-overview.md) | Vision, ethos, personas, glossary, MVP scope | Everyone — read first |
| [specs/FS-01 … FS-07](./specs/) | Functional specifications, one per module | Architect + implementing agents |
| [agent-playbook.md](./agent-playbook.md) | How agents turn specs into shipped code | All agents + orchestrator |
| [../swab-domain-spec.md](../swab-domain-spec.md) | Data model + Prisma schema v0.1 | Data Steward, Backend |
| [../aidd-multi-agent-blueprint.md](../aidd-multi-agent-blueprint.md) | AIDD architecture, pipeline, deployment decisions | Human + DevOps agent |
| [../agents/](../agents/) | Agent prompts (source of truth for rendered rules) | contextpack.ts |

## Documentation conventions

- **Requirement IDs are law.** Every functional requirement has a stable ID (`ONB-03`, `ENV-11`…). Issues, PRs, commits, and tests reference these IDs — that's the traceability chain: `FS requirement → GitHub issue → PR → test name`. A requirement without a referencing test is unimplemented, whatever the code says.
- **Specs are versioned by PR.** Changing behavior means changing the spec in the same PR (or a preceding one) — code and spec never disagree on `main`. Specs carry a `Status` header: `Draft` → `Approved` (human sign-off) → `Implemented`.
- **Assumptions are explicit.** Anything not yet decided by Hamza is marked `⚠️ ASSUMPTION` with the fallback noted. Current global assumptions: hybrid local-first privacy model, phone-OTP identity, category-based match compatibility (see product-overview §6).
- Language: docs in English, UI copy in French (source strings in `fr`, keys in English). UI copy quoted from the blueprints is normative — don't paraphrase it.

## MVP module map

```
FS-07 Identity & Vault  ──┐  (foundation: everything depends on it)
FS-01 Onboarding        ──┤
FS-02 Relationship Map  ──┼── FS-04 Subgroups (scopes) ──┐
FS-03 Contact Card      ──┘                              ├── FS-05 Envie & Match
                              FS-06 Filtering rules   ───┘
```
