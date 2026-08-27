# SUG-SPEC-014 — Phase 0b: amend the binding directives so ADR-002 is legal

- **Area:** specs (cross-cutting — touches `agents/`, `.specify/`, `CLAUDE.md`, `README.md`)
- **Topic:** governance / unblocking
- **Impact:** 🚫 **blocking** — no ADR-002 work of any kind may start before this lands
- **Effort:** S (one clause + one rendered propagation + four prose lines)
- **Implementing agent:** spec-specialist (`.claude/agents/spec-specialist.md`)
- **Related:** [ADR-002](../../docs/decisions/ADR-002-envie-becomes-a-proposition.md), [ROADMAP Phase 0b](../../docs/ROADMAP.md)

## Problem

[`agents/_global-directives.md`](../../agents/_global-directives.md) G1(d) reads:

> (d) reveal stays strictly mutual — the server may compute a match but must not disclose a one-sided envie to anyone.

That file is prepended to **every** agent prompt and is the single source of truth for scope
enforcement. ADR-002 makes a proposition directed and visible to its recipients — exactly what (d)
forbids. Until (d) is amended, every agent is *required* to reject the pivot as a privacy violation,
and a review-specialist run would be correct to block the PR.

Four other files assert the same retired rule and will contradict `main` the moment FS-05 is rewritten:
`.specify/memory/constitution.md:71` (spec-kit's planning gate), `CLAUDE.md` (app description),
`README.md:15` (product law 1), `agents/_global-directives.md`'s own "## Project" paragraph.

## Implementation plan

**Order matters — the render script overwrites `.github/` and `.claude/agents/` from `agents/`.
Never edit a rendered file by hand.**

1. In `/Users/mikedown/Workspace/Swab/agents/_global-directives.md`, G1, replace **only** clause (d):

   ```
   (d) reveal stays strictly mutual — the server may compute a match but must not disclose a one-sided envie to anyone.
   ```

   with:

   ```
   (d) a proposition is directed and visible to its recipients (`docs/decisions/ADR-002-envie-becomes-a-proposition.md`), and its proposer is always named — but **silence is never explained**: ignoring a proposition must be indistinguishable from never having seen it, with no read receipts, no delivery status, no « vu », and no signal of any kind back to the proposer. There is no decline action anywhere; expiry is the only exit, and it looks identical whether the recipient was uninterested, busy, or absent. A recipient's identity is disclosed to the *other* recipients only by that recipient's own explicit choice, and a group is private to its owner — creating one, or adding someone to it, notifies nobody and is visible to nobody.
   ```

2. **Do not touch (a), (b), or (c).** They are all satisfied by ADR-002 commitments 3–5 and were
   re-verified on 2026-08-27. In particular (a)'s « X t'a ajouté » prohibition survives intact
   *because* groups are owner-private — widening it would be a regression, not a cleanup.

2b. ⚠️ **Known tension to flag, not to resolve here.** The clause above says *"There is no decline
   action anywhere"*. FS-05 `ENV-13`/`ENV-15` give the recipient **« Passer cette fois »** — a decline
   that emits zero signal to anyone, which is arguably exactly what the clause protects. Raise this
   with the founder as **OQ-PRO-10** (tracked in
   [SUG-SPEC-016](SUG-SPEC-016-adr002-fs05-rewrite.md) step 2). If « Passer cette fois » survives, the
   clause needs one qualifier: *"no decline action **that the proposer can observe**"*. Land the
   amendment either way — a pending OQ must not block Phase 0b — but do not silently soften the
   wording on your own judgement.

3. Same file, "## Project" paragraph — replace *"an app to express desires (\"envies\") to scopes of
   friends, revealed only on mutual match"* with a proposition-model sentence, e.g. *"an app to
   propose seeing your friends — a directed « envie » naming what, when and where, answered by accept
   / counter-propose / ignore, and never by a visible refusal."*

4. Run `node scripts/render-agents.mjs`. Confirm it rewrote `.github/copilot-instructions.md`,
   `.github/instructions/*.instructions.md`, and `.claude/agents/*.md`. Commit the rendered output.

5. Re-run `/speckit-constitution` to regenerate `.specify/memory/constitution.md` from the amended
   directives. Verify line ~71's (d) now matches. **Bump the constitution version** and record the
   amendment in its history block — SUG-SPEC-003 was filed once already for constitution drift; do
   not repeat it.

6. `/Users/mikedown/Workspace/Swab/CLAUDE.md` — first paragraph currently says *"you express an
   'envie' to a scope; it's revealed only if mutual"*. Rewrite to the proposition model. Add one line
   to **Hard boundaries**: *"A group is private to its creator; a recipient learns only that a
   proposition arrived and that a few others were invited — never who, never how many."*

7. `/Users/mikedown/Workspace/Swab/README.md:15` — product law 1 mirrors `docs/product-overview.md`.
   **Leave the wording to [SUG-SPEC-015](SUG-SPEC-015-adr002-product-overview-laws.md)** so both files
   are rewritten from one drafting pass, but add a one-line `> ⚠️ Superseded by ADR-002 — rewrite
   pending` marker here now, so nothing on `main` asserts the retired law unqualified.

8. Root `CHANGELOG.md` entry (G5) under `## 2026-08-27` or a new date — record that exactly one
   clause changed and that (a)/(b)/(c) were verified as needing no amendment. That verification is
   the part a future reader will otherwise redo.

## Tests & acceptance criteria

- `node scripts/render-agents.mjs --check` exits clean (CI runs this — a stale render is a hard fail).
- `grep -rn "strictly mutual" --include="*.md" .` returns **only** historical references:
  `CHANGELOG.md`, `docs/decisions/ADR-002-*.md`, `docs/archive/`, and this file. No live directive,
  agent prompt, rendered instruction, or constitution line survives.
- `grep -rn "revealed only" CLAUDE.md README.md agents/_global-directives.md` returns nothing.
- Sanity check the propagation actually happened: `grep -c "silence is never explained"
  .github/copilot-instructions.md` returns ≥ 1.

## Risks

- **Rendered-file drift.** Editing `.github/` or `.claude/agents/` by hand instead of re-rendering
  will pass locally and fail CI's `--check`. Run the script, do not hand-edit.
- **Scope creep into (a)–(c).** The temptation while in the file is to "tidy" the privacy clauses.
  Don't — the pivot narrowed after the 2026-08-27 ADR revision, and (a)–(c) are load-bearing exactly
  as written.
- **Constitution version drift.** `/speckit-constitution` regenerates but does not always bump the
  version header; check it manually (precedent: SUG-SPEC-003).
