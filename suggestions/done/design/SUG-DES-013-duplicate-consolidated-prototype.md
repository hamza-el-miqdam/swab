# SUG-DES-013 — The normative consolidated prototype exists as two byte-identical files with no sync mechanism

- **Area:** design
- **Topic:** docs
- **Impact:** low
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

`blueprints/swab-app-prototype.html` and `docs/design/swab-prototype-consolidated.html` are currently byte-identical (both 60,840 bytes, identical MD5 `744f04ec876345d4bc21bfe992b58f59`) — but nothing guards that. The normative chain names ONE file: "The consolidated prototype (`docs/design/swab-prototype-consolidated.html` …) is normative for every value" (`agents/design-specialist.md:40-42`), and `docs/design-system.md:4-5` links only that path; yet `agents/design-specialist.md:47-48` also says blueprints comprise "one file per flow **plus a consolidated prototype file**", institutionalizing the copy. First edit that touches only one of them creates silent drift between two files that both look authoritative — the exact failure mode the repo solves elsewhere with render scripts + `--check` (agents, tokens).

## Implementation plan

Pick one (both are small; A is recommended):

- **Option A — single file + pointer.** Replace the *content* of `blueprints/swab-app-prototype.html` with a one-screen HTML stub: "Moved — the consolidated prototype is normative at `docs/design/swab-prototype-consolidated.html`" (keep the filename so old links don't 404 in previews). Amend the sentence in `agents/design-specialist.md:47-48` to "…one file per flow; the consolidated prototype lives at `docs/design/swab-prototype-consolidated.html`" and re-run `node scripts/render-agents.mjs` (agents renders are CI-checked).
- **Option B — guarded copy.** Keep both, add a sync check to an existing check script (e.g. a 5-line step in `packages/ui/scripts/generate.mjs --check`: read both files, error `PROTOTYPE COPIES DIVERGED` if bytes differ).

Either way: root `CHANGELOG.md` entry (area:design).

## Tests & acceptance criteria

- Option A: `wc -c blueprints/swab-app-prototype.html` is tiny; grep confirms the pointer text; `node scripts/render-agents.mjs --check` green.
- Option B: intentionally add a space to one copy → `generate.mjs --check` exits 1; revert → green.
- Only one path is cited as normative across `agents/design-specialist.md`, `docs/design-system.md`, and `packages/ui/tokens/tokens.json:6` (the meta.rule already cites the docs/design path — consistent today).

## Risks & gotchas

- Editing `agents/design-specialist.md` requires re-rendering `.claude/agents/` + `.github/` copies in the same PR (CI drift gate, `.github/workflows/ci.yml:25-26`).
- Do this before SUG-DES-010's copy fix lands, or that fix must remember to touch both copies.
