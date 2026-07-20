# SUG-SPEC-003 — Constitution has drifted from agents/_global-directives.md (stale changelog paths, missing E2E gate, stale areas)

- **Area:** specs
- **Topic:** process
- **Impact:** high
- **Effort:** M
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** none (governance surface — G2/G5 mirrors)

## Problem / Opportunity

`.specify/memory/constitution.md` is spec-kit's planning-time gate and must mirror `agents/_global-directives.md` (CLAUDE.md: "it mirrors `agents/_global-directives.md` … Amend the global directives first, then re-run `/speckit-constitution` to resync"). It was last amended 2026-07-09 (`constitution.md:178`) and now diverges in substance:

1. **Stale changelog areas (Principle V vs G5).** `constitution.md:118-120` lists `apps/mobile/CHANGELOG.md` (area:mobile) and omits design/specs areas. The directives' G5 now lists `apps/ios/CHANGELOG.md` (area:ios), `apps/android/CHANGELOG.md` (area:android), and root CHANGELOG for "area:devops, docs, agents, design, specs, tooling" (`agents/_global-directives.md`, G5 first bullet). `apps/mobile` was removed 2026-07-19 — a `/speckit-plan` Constitution Check would today instruct writing to a changelog file that does not exist.
2. **Missing E2E gate (Principle II vs G2).** G2 now contains the mobile E2E Definition-of-Done gate (scenarios in `docs/qa/e2e-scenarios.md`, manifest `docs/qa/e2e-coverage.json`, `scripts/e2e-{ios,android}.sh` must PASS with zero drift). Constitution Principle II (`constitution.md:53-68`) says nothing about it, so spec-kit plans for FS-04/05/06 will not gate on E2E coverage entries.
3. **Missing G5 compaction rule.** The "Changelog entries are summaries, not session logs … ≤ 15 lines" bullet (G5, added with the 2026-07-19 agents review, commit 062a0ff) is absent from Principle V, as is "flip the spec's `Status:` header to `Implemented`" (`_global-directives.md` G5 STATUS bullet vs `constitution.md:123-125`).
4. **Unresolved ratification TODO.** `constitution.md:177-178`: `TODO(RATIFICATION_DATE)` still pending.

The Governance section itself (`constitution.md:162-168`) mandates resync via `/speckit-constitution` when the source changes — that resync never happened after the native migration.

## Implementation plan

1. Run the `/speckit-constitution` skill with the current text of `agents/_global-directives.md` as input (do NOT hand-edit substance — Governance forbids it).
2. Ensure the regenerated Principle V lists exactly: `apps/ios/CHANGELOG.md` (area:ios), `apps/android/CHANGELOG.md` (area:android), `apps/api/CHANGELOG.md` (area:backend), `packages/db/CHANGELOG.md` (area:db), root `CHANGELOG.md` (area:devops, docs, agents, design, specs, tooling, cross-cutting), plus the ≤15-line summary rule and the "flip spec Status header" rule.
3. Ensure Principle II includes the E2E gate paragraph (scenarios file, manifest with the five verification classes, `scripts/e2e-{ios,android}.sh` PASS + zero drift as DoD for area:ios/android).
4. Resolve `TODO(RATIFICATION_DATE)`: `git log --follow --format=%ad --date=short -- agents/_global-directives.md | tail -1` gives the original adoption date; set it.
5. Bump version per the file's semver convention (MINOR — principles materially expanded/re-worded, none removed) and update the Sync Impact Report comment + `Last Amended` date.
6. Root `CHANGELOG.md` entry (`area:specs`).

## Tests & acceptance criteria

- `grep -n "apps/mobile" .specify/memory/constitution.md` → zero hits.
- `grep -n "e2e" .specify/memory/constitution.md` → hits in Principle II.
- `grep -n "TODO(" .specify/memory/constitution.md` → zero hits.
- Version and `Last Amended` updated; Sync Impact Report reflects the change list.

## Risks & gotchas

- Only resync FROM the directives — never introduce constitution-only substance (Governance: "the global directives file wins").
- The Additional Constraints / Development Workflow sections are Swab-specific and legitimately have no directives counterpart — keep them, but check the "French UI copy" constraint still matches CLAUDE.md's hard-boundary wording.
- Existing spec-kit artifact `specs/001-envie-match/` was validated against constitution v1.0.0; no re-validation needed (no principle removed), but note the version bump in the changelog entry.
