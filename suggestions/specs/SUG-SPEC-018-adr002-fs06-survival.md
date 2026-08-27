# SUG-SPEC-018 — Phase 0c.4: decide whether FS-06 survives (OQ-PRO-7)

- **Area:** specs
- **Topic:** decision, then execution — the outcome is one of three, and two of them are cheap
- **Impact:** medium — but it gates FS-05's `PRO-03`/`PRO-04` (the pre-send review)
- **Effort:** S (decision) + S–M (execution, depending on the answer)
- **Implementing agent:** spec-specialist — **the decision itself is the founder's**
- **Depends on:** [SUG-SPEC-016](SUG-SPEC-016-adr002-fs05-rewrite.md) is easier if this lands first,
  but it can also land second with FS-05 leaving `PRO-03`/`PRO-04` provisional
- **Related:** [ADR-002](../../docs/decisions/ADR-002-envie-becomes-a-proposition.md) OQ-PRO-7, [FS-06](../../docs/specs/FS-06-filtering.md)

## Problem

FS-06 (`FLT-*`) describes **silent filtering**: you broadcast to a portée, and rules quietly subtract
people before it goes out — the pre-send review (`ENV-03`/`ENV-04`) exists precisely so that
subtraction is not hidden (product law 2).

ADR-002 makes the target a group you assembled by hand. Filtering a list you just built yourself is
incoherent: you would be removing people you deliberately added, moments ago, in the same session.
`docs/STATUS.md:22` records this as **survival undecided (OQ-PRO-7)**, and notes that FS-06's prior
design notes (rules server-side, on-device evaluation per `OQ-FLT-2`) all assume the retired broadcast
model.

One clause almost certainly survives regardless: **`FLT-02`'s veto absolu** — "never show me anything
involving this person, ever, invisibly". That is not a filter on a broadcast; it is a standing
personal boundary, and it is the one rule that still makes sense when you are hand-picking recipients.

## The decision (founder's — present these three, do not pick one)

- **(A) Retire FS-06 entirely.** Manual group construction *is* the filtering. Veto absolu migrates
  into FS-03 (contact card) or FS-04 as a per-contact property. Cheapest; loses the standing-rule
  affordance.
- **(B) Keep FS-06, narrowed to standing personal boundaries.** Veto absolu survives; the
  rule-level/priority machinery and the pre-send « Filtrés par tes règles » column are retired. The
  rules become a safety net over hand-picked lists, not a subtraction engine.
- **(C) Keep FS-06, repurposed as the input to FCA suggestions.** Rules stop filtering sends and
  instead shape which groups FS-04 proposes. Most work; most speculative; only worth it if the founder
  wants rules to keep earning their complexity.

**Recommendation to put in front of the founder: (B).** It preserves the one requirement that still
has a job, deletes the machinery the pivot made incoherent, and does not invent a new role for rules
that nobody has asked for. But this is a product decision — record the founder's answer in ADR-002
under OQ-PRO-7 before executing (G4: don't guess product behaviour).

## Implementation plan

### Step 0 — before anything

Read FS-06 in full and list which `FLT-*` requirements are (i) about silent subtraction from a
broadcast, (ii) about standing personal boundaries, (iii) about storage/evaluation mechanics. That
three-way split is what makes the decision answerable in one sitting rather than a debate. Put it in
the issue where you ask the founder.

### Then, per outcome

**If (A):**
1. Mark FS-06 `Status: Retired — superseded by ADR-002` in its header; keep the file (six specs and
   `docs/STATUS.md` link it). Do not delete.
2. Move veto absolu to FS-03 or FS-04 as a new requirement, keeping its invisibility guarantee
   verbatim — a vetoed person must appear in no list, no review, no suggestion.
3. FS-05 `PRO-03`/`PRO-04`: the pre-send review keeps the **Inclus** list (law 2) and loses the
   **Filtrés par tes règles** column.
4. `docs/STATUS.md` FS-06 row → ⚫/retired. Update the FS-05 `Depends on:` header line.

**If (B):**
1. Rewrite FS-06's purpose around standing boundaries. Keep `FLT-02` verbatim.
2. Retire the rule-level/priority requirements and their pre-send surfacing. Use a disposition table
   like [SUG-SPEC-016](SUG-SPEC-016-adr002-fs05-rewrite.md) step 1 — same reason: renumbering without
   a forwarding address breaks traceability (`docs/README.md:13-18`).
3. Resolve or retire `OQ-FLT-2` (on-device evaluation) — with server-side owner-scoped groups, the
   premise it was arguing about has changed. Do not leave it open citing a model that no longer exists.
4. FS-05 `PRO-03`/`PRO-04` as in (A) step 3: veto'd people appear nowhere, per `FLT-02`.

**If (C):** open a separate `/speckit-specify` pass. It is a new feature, not an amendment, and
should not ride in a Phase 0c PR.

### Always

Root `CHANGELOG.md` entry (G5) · `docs/STATUS.md` FS-06 row · record the answer in ADR-002 under
OQ-PRO-7 (amend in place, note the date — same convention the 2026-08-27 revision used) ·
`suggestions/README.md` counts.

## Tests & acceptance criteria

- ADR-002's OQ-PRO-7 shows a dated resolution, not an open question.
- `docs/STATUS.md`'s FS-06 row matches the chosen outcome and no longer says "undecided".
- Whatever the outcome, `grep -rn "veto absolu\|FLT-02" docs/specs/` resolves to exactly one live
  definition — not zero (lost in the move) and not two (copied, not moved).
- FS-05's `Depends on:` header and FS-06's status agree.
- If (B): every retired `FLT-*` ID has a disposition-table row.

## Risks

- **Losing veto absolu in the shuffle.** It is the one requirement here with a real user protecting
  behind it, and it is easy to drop while retiring the machinery around it. The grep above is the guard.
- **Deciding by drafting.** Whoever executes this will have an opinion after step 0. That opinion is
  not the decision. Ask, wait, then execute — this is exactly the case G4's « comment on the issue and
  stop » was written for.
- **Blocking FS-05 on it.** Don't. If the answer is slow, FS-05 can ship with `PRO-03`/`PRO-04` marked
  ⚠️ PROVISIONAL pending OQ-PRO-7, the same way `ENV-17`'s N=150 has sat as ⚠️ PROPOSED.
