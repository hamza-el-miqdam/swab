# SUG-SPEC-010 — Playbook ownership matrix and all FS `Agents:` headers still name the decommissioned "Mobile" agent

- **Area:** specs
- **Topic:** process
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md) — name notion-liaison-specialist for the header re-sync
- **Related requirement IDs:** none (ownership metadata across FS-01..07)

## Problem / Opportunity

The mobile-specialist (Expo RN) was decommissioned 2026-07-09 and mobile work now belongs to the ios-specialist + android-specialist (CLAUDE.md "Where things are"; `agents/` contains `ios-specialist.md` and `android-specialist.md`, no mobile file). But the operational docs still route work to "Mobile":

- `docs/agent-playbook.md:9-15` — ownership matrix: "FS-01 … Mobile", "FS-02 … Mobile", …, "FS-05 … Mobile + Backend", "FS-07 … Backend | Mobile, Data, Web".
- `docs/agent-playbook.md:24-25` — build order: "Mobile: FS-01 onboarding + FS-02 map", "Mobile: FS-03 fiche + FS-06 filtering + FS-04 FCA", "Mobile+Backend: FS-05 end-to-end".
- Every spec header: `docs/specs/FS-01-onboarding.md:3` "**Agents:** Mobile (lead), Backend (auth endpoints)"; `FS-02:3` "Mobile (sole)"; `FS-03:3` "Mobile (sole)"; `FS-04:3` "Mobile (sole — FCA runs on-device)"; `FS-05:3` "Mobile (flow UI, local resolution) + Backend"; `FS-06:3` "Mobile (sole …)"; `FS-07:3` "… Mobile (vault client) …".

The playbook says the orchestrator "assumes" this document (`agent-playbook.md:3`) — issues for the unbuilt FS-04/05/06 would be created against an agent that no longer exists. Also stale in the same file: `agent-playbook.md:22` "Neon GC" build-order line and `:57` "The SRE agent" (current name: devops) — minor, fix in passing.

## Implementation plan

1. `docs/agent-playbook.md` §1: replace every "Mobile" cell with "iOS + Android" (FS-05 row: "iOS + Android + Backend"). Keep seams unchanged.
2. `docs/agent-playbook.md` §2: same substitution in the Sprint 2/3/4 lines.
3. `docs/agent-playbook.md:57`: "The SRE agent" → "The DevOps agent (area:sre)" (the label `area:sre` is still real — see devops agent description — so keep it as the parenthetical).
4. Spec headers FS-01..07 line 3: replace "Mobile" with "iOS + Android" (e.g. FS-04: "**Agents:** iOS + Android (sole — FCA runs on-device)"). Do not touch Status/Depends-on/Blueprint fields (FS-07's Status is SUG-SPEC-002's separate fix — coordinate to avoid edit conflicts on the same line).
5. Add one clarifying sentence to playbook §1 footer: "'iOS + Android' means the same requirement is implemented per-platform by ios-specialist and android-specialist, each gated by its own E2E suite (G2)."
6. Root `CHANGELOG.md` entry (`area:specs` / docs); notion-liaison re-sync (headers are mirrored).

## Tests & acceptance criteria

- `grep -rn "Mobile" docs/agent-playbook.md docs/specs/` → zero hits as an agent name (occurrences inside prose like "mid-range Android device" are fine; check hits manually).
- `node scripts/render-agents.mjs --check` still passes (this change touches no `agents/` source, so rendering must be unaffected — the check proves no accidental coupling).
- Issue templates per playbook §3 can name a real `area:ios`/`area:android` label for FS-04/05/06 work.

## Risks & gotchas

- FS-07 line 3 is also edited by SUG-SPEC-002 — sequence the two PRs (one issue = one branch = one PR, G4).
- `docs/migration/rn-native-handoff.md` intentionally documents the retired agent — leave it alone.
- The Notion mirror shows headers; the co-founder-facing French must translate "iOS + Android" as-is.
