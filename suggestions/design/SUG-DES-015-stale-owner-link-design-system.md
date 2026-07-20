# SUG-DES-015 — `docs/design-system.md` names a nonexistent owner file (`agents/design-system-specialist.md`)

- **Area:** design
- **Topic:** docs
- **Impact:** low
- **Effort:** S
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

`docs/design-system.md:9` reads: "Owner: Design System Steward (`agents/design-system-specialist.md`)". No such file exists — the agents directory contains `agents/design-specialist.md` (the file whose scope declares ownership of `docs/design-system.md`, `agents/design-specialist.md:17-19`), and the rendered subagent list uses the name "Design & Design-System Specialist" (`agents/design-specialist.md:1`). A stale pointer in the token contract's own header sends readers (and agents resolving ownership before opening an `area:design` issue) to a dead path — a small violation of G5's "Docs stay truthful … Code and docs never disagree on `main`."

## Implementation plan

1. Edit `docs/design-system.md:9`: replace "Owner: Design System Steward (`agents/design-system-specialist.md`)" with "Owner: Design & Design-System Specialist (`agents/design-specialist.md`, `area:design`)".
2. While in the header, sanity-sweep the file's other pointers (already verified correct in this audit: the prototype link `design/swab-prototype-consolidated.html` at `:5`, the tokens.json link at `:132`, generator path at `:137` — no other stale references found).
3. Root `CHANGELOG.md` entry (can ride along with any other design PR — too small to ship alone; G4 one-issue-one-PR still applies, so attach it to the next design change, e.g. SUG-DES-009).

## Tests & acceptance criteria

- `grep -rn "design-system-specialist" docs/ agents/ .github/ .claude/` returns nothing.
- The named path exists: `test -f agents/design-specialist.md`.

## Risks & gotchas

- Fix the doc, not the agents tree — do NOT create/rename agent files to match the stale doc; `agents/*.md` is the source of truth and `scripts/render-agents.mjs --check` guards its renders (`.github/workflows/ci.yml:25-26`).
