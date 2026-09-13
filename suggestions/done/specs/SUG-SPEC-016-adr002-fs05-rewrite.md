# SUG-SPEC-016 — Phase 0c.2: rewrite FS-05 as the proposition flow (ENV-* → PRO-*)

> **DONE 2026-09-13** — `docs/specs/FS-05-envie-match.md` rewritten per this plan; issue
> [#180](https://github.com/hamza-el-miqdam/swab/issues/180). All 11 OQ-PRO-* resolutions (not just the
> two gating ones) are written into the rewrite; ENV-01…ENV-20 disposition table lives at the bottom of
> the new FS-05. `specs/001-envie-match/` marked superseded, not hand-edited. Moved here from
> `suggestions/specs/`.

- **Area:** specs
- **Topic:** full spec rewrite + requirement-ID renumbering
- **Impact:** highest — FS-05 is the core loop; everything downstream of it is currently written against a retired model
- **Effort:** L (the only spec that is rewritten rather than amended; expect its own PR, alone)
- **Implementing agent:** spec-specialist
- **Depends on:** [SUG-SPEC-014](../../specs/SUG-SPEC-014-adr002-amend-binding-directives.md) **and** [SUG-SPEC-015](../../specs/SUG-SPEC-015-adr002-product-overview-laws.md)
- **Related:** [ADR-002](../../../docs/decisions/ADR-002-envie-becomes-a-proposition.md), [FS-05](../../../docs/specs/FS-05-envie-match.md)

## ✅ Gate cleared 2026-09-13 — resolutions recorded in ADR-002

All open questions this plan depended on are answered by the founder; see
[ADR-002](../../../docs/decisions/ADR-002-envie-becomes-a-proposition.md)'s "Open questions — RESOLVED"
section for the full text. Summary for this plan's two gating questions (plus an ID fix):

1. **OQ-PRO-6 — how does a group converge?** **Named revealers + a vague, non-numeric cue for
   anonymous accepters** (e.g. « et d'autres personnes ont accepté »). Never a count.
2. ~~**OQ-PRO-1**~~ **renumbered `OQ-PRO-11`** — this question ("is the group the only target, or can
   a proposition go to individuals?") was never actually `OQ-PRO-1` in the ADR; that ID already named a
   different question (the non-mutual-contact refusal leak). Every reference to "OQ-PRO-1" below in
   this file should read **`OQ-PRO-11`**. Resolution: **individual is the base case, a saved group is
   optional** — `PRO-02` describes one target type (a recipient list); a group is just a convenience
   for populating it, not a separate API shape.

Also now resolved and binding on the rewrite: **OQ-PRO-1** (silent accept-and-drop, no explicit error),
**OQ-PRO-2** (counter-proposals are parallel options, capped — not a replace), **OQ-PRO-3** (acceptances
persist past 48h expiry, only new responses close), **OQ-PRO-4** (silent per-proposer mute), **OQ-PRO-5**
(category kept, narrowly, for history browsing only), **OQ-PRO-8** (no "prefer everyone named" feature),
**OQ-PRO-10** (« Passer cette fois » is a local hide, not a decline — no G1(d) amendment needed, but say
so explicitly in the spec text). Write all of these into the rewrite, not just the two headline ones.

Secondary, answer alongside: **§6 categories** (settled in SUG-SPEC-015 step 6, and now OQ-PRO-5 above)
— if categories died with the matching engine, `ENV-01`'s category half survives narrowly per OQ-PRO-5;
`OQ-ENV-1`'s full taxonomy question stays dead.

## Problem

`docs/specs/FS-05-envie-match.md` is 68 lines describing a mutual-match engine. ADR-002 retires the
engine outright. But the file is not uniformly dead: roughly a third of its requirements are about
*calm* and *silence* rather than matching, and those are not only still valid — they are now
**load-bearing**, because G1(d)'s new silence clause depends on them.

Rewriting the file wholesale without a disposition table would silently drop ENV-06, ENV-11, ENV-15,
ENV-16, ENV-18 and ENV-20, which is how a rewrite loses a product's soul. `docs/README.md:13-18`
also makes requirement IDs the spine of traceability (`FS requirement → GitHub issue → PR → test
name`), so a renumbering that leaves no forwarding address breaks every existing citation.

## Implementation plan

### 1. Write the disposition table FIRST, into the new spec

Put it in a `## Retired requirement IDs (ENV-* → PRO-*)` section at the **bottom** of the rewritten
FS-05, before the open questions. This table is the forwarding address `docs/README.md` traceability
needs. Do not delete it later.

| Old | Disposition | Note for the rewrite |
|---|---|---|
| ENV-01 | **Carries** (verb) / conditional (category) | Free-text present-tense verb survives whole. The `category` half lives or dies with §6. |
| ENV-02 | **VOID** | « Une portée, pas une personne » is explicitly retired by ADR-002. Replaced by the OQ-PRO-11 answer. |
| ENV-03 | **Reframe** | Pre-send review survives as « rien n'est masqué en silence » (law 2), but the « Filtrés par tes règles » column depends on FS-06 (OQ-PRO-7 — see [SUG-SPEC-018](../../specs/SUG-SPEC-018-adr002-fs06-survival.md)). |
| ENV-04 | **Reframe** | Same dependency as ENV-03. |
| ENV-05 | **VOID as written** | On-device resolution was justified by "the server doesn't store membership". Under ADR-002 `Group`/`GroupMember` **are** server rows (owner-scoped), so the server resolves. Rewrite, and state the owner-scoping as an authorization rule. |
| ENV-06 | **Carries verbatim** | « C'est parti, doucement. » + no delivery status, no seen-by, no pending counter. **Now doubly binding** — it is the client half of G1(d)'s silence clause. |
| ENV-07 | **Carries, minus one clause** | 48h default and the frozen « Elle expire dans 48 heures. » survive. The trailing « Expiry is invisible to recipients (they never knew) » is **void** — recipients now know. |
| ENV-08 | **VOID** | The match condition. The engine will not be built. |
| ENV-09 | **VOID** | `@@unique([envieAId, envieBId])` race arbiter — no pairs, no race. |
| ENV-10 | **Reframe** | Outbox survives as a mechanism; « both parties in the same logical operation » is void (delivery is one-way, to N recipients). |
| ENV-11 | **Carries, transformed — the most important one** | "Non-matches are absolutely unobservable" becomes: **ignoring a proposition is absolutely unobservable**. No API response, timing signature, or push behaviour may differ between "hasn't answered", "never opened it", and "doesn't use the app". This is the direct ancestor of the amended G1(d); write it with at least the old requirement's rigour. |
| ENV-12 | **Carries, reworded** | Withdrawn/expired propositions can no longer be *accepted*; acceptances already made survive. |
| ENV-13 | **Rewrite** | The action set changes: accept-without-revealing, accept-and-reveal, counter-propose (parallel, capped — OQ-PRO-2), ignore. **Proposer un lieu** / **Proposer une heure** survive; **« Passer cette fois »** survives too, reframed per OQ-PRO-10 (§2 below) as a local hide, not a decline. |
| ENV-14 | **Reframe** | The single-proposal loop becomes N-recipient; « no negotiation threads » should be re-confirmed, not assumed. The `422` on an empty proposal survives. |
| ENV-15 | **Carries, generalised** | Bit-identical counterpart responses generalise from "the counterpart" to "the proposer and every other recipient". |
| ENV-16 | **Carries verbatim** | No « match ! », no counters, ever. Law 5, untouched by ADR-002. |
| ENV-17 | **Carries, adapted** | Server-side Zod validation (G1) survives entirely; the `recipientIds` clause is rewritten per OQ-PRO-11. N=150 stays ⚠️ PROPOSED. |
| ENV-18 | **Carries verbatim** | `idempotencyKey` unique per author, retry returns the original `200`. Drop only the "never a recomputed match" sub-clause. |
| ENV-19 | **Reframe** | The relationship event fires on **acceptance**, not on match. Grain `{date, category}` stays ⚠️ PROPOSED and depends on §6. Never the verb. |
| ENV-20 | **Carries, new rationale** | Verb stays opaque server-side. The old justification (keeping ADR-001 option B reachable) still holds, but the verb is now shown to recipients **by design** — say so explicitly so nobody reads ENV-20 as a confidentiality claim it never made. |

Open questions: `OQ-ENV-1` conditional on §6 · `OQ-ENV-2` (48h rolling vs calendar cutoff) **carries
unchanged** · `OQ-ENV-3` (`recipientIds ⊆ author's ContactLink targets`) **carries and sharpens** —
with server-side group resolution the server sees more, so re-argue both sides rather than assuming
the pivot settled it · `OQ-ENV-4` and `OQ-ENV-5` are RESOLVED; carry their resolutions forward as
frozen copy, do not reopen them.

### 2. ✅ OQ-PRO-10 resolved — the « Passer cette fois » collision

SUG-SPEC-014's G1(d) wording says *"There is no decline action anywhere; expiry is the only exit"*.
FS-05 `ENV-13`/`ENV-15` give the recipient **« Passer cette fois »**, a decline that emits **zero**
signal to anyone.

**Resolution (ADR-002, 2026-09-13): reframed as a local "hide", not a "decline" — G1(d) needs no
amendment.** « Passer cette fois » removes the card from the recipient's own view only and sends
nothing to anyone, so it was never the kind of decline G1(d) governs (signals reaching the proposer).
Write the FS-05 copy/spec text to say this explicitly — describe the action as list-management
(archiving), not as a response type — so a future reader doesn't reclassify it as a decline.

### 3. Rewrite the file

New IDs are **`PRO-01`…`PRO-nn`**, numbered fresh from 1. Do not reuse ENV numbers with new meanings —
that is the one thing guaranteed to make a stale citation resolve to the wrong requirement silently.

Structure to keep from the current file (it is a good spec): Purpose · User stories · requirement
tables grouped by actor · **API contract** section as the mobile↔backend seam · Acceptance criteria ·
Open questions. Rename the file to `docs/specs/FS-05-envie-proposition.md` **only if** you also
update every path reference (grep first); otherwise keep the filename and change the `#` title.

Binding copy requirements for the new text:
- The two accept modes must state **to whom** identity is hidden. The proposer always sees who
  accepted, in both modes. No unqualified « anonyme » (ADR-002 commitment 5).
- The other-recipients hint is **vague, never a number** — « et quelques autres personnes » is an
  illustrative placeholder and must not resolve to a digit (ADR-002 commitment 4, product law 5).
- Revealing later is always available and is one-way. Anonymity has no expiry (OQ-PRO-8 notes the
  founder may revisit this; until then, no expiry).
- No API response may ever tell a recipient which group they came from. The group is a template.

### 4. Update the seam and the artifacts built on the old model

- **API contract section** — the old seam (`POST /envies`, `GET /matches`, `POST /matches/:id/pass`,
  `POST /matches/:id/proposals`, `POST /proposals/:id/accept`) loses everything under `/matches`.
  Sketch the replacement in the spec; **do not implement it here** — that is a separate `area:backend`
  issue, and this PR must stay under the ~400-line cap (G4).
- **`specs/001-envie-match/`** — the spec-kit artifact set (`spec.md`, `checklists/requirements.md`,
  and any plan/tasks files) is built entirely on the matching model. Do **not** hand-edit it. Mark the
  directory superseded with a header note pointing at ADR-002 and the rewritten FS-05, and re-run
  `/speckit-specify` from the new spec when it is approved.
- **`docs/specs/.notion-sync.json`** — the French Notion mirror is already stale since ADR-001 and
  will diverge further. Do not sync in this PR; add a line to the STATUS.md sync row noting FS-05 is
  now a *rewrite* rather than a diff, so the notion-liaison-specialist replaces the page instead of
  merging it.
- **`docs/qa/e2e-coverage.json`** — verified to contain **zero** `ENV-` references. No manifest work
  is needed. (Recorded here so nobody re-checks.)

### 5. Hand off the schema and dead-code cleanups — do not do them yourself

`packages/db/prisma/schema.prisma` has exactly one writer (G4). Open an **`area:db`** issue covering:
- `Match` / `MatchState` / the canonical-order CHECK / per-side pass markers → dead schema.
- `Group` / `GroupMember` as **owner-scoped** rows; `EnvieRecipient.revealed` per-recipient flag;
  time/place option storage.
- `packages/db/prisma/seed.ts` and `packages/db/tests/migrations.test.ts` both reference the match
  models and will break.

Also mark these two existing suggestions **VOID (superseded by ADR-002)** with a one-line header note —
their premises no longer exist: `suggestions/db/SUG-DB-003` (match reversed-pair race) and
`suggestions/db/SUG-DB-006` (passed-state-per-side).

### 6. Housekeeping (G5)

`docs/STATUS.md` FS-05 row → note the rewrite landed and what unblocked · root `CHANGELOG.md` entry ·
update `suggestions/README.md` counts.

## Tests & acceptance criteria

- `grep -n "ENV-" docs/specs/FS-05-*.md` returns hits **only** inside the disposition table.
- `grep -rn "ENV-0[0-9]\|ENV-1[0-9]\|ENV-20" docs/ specs/ agents/ apps/ packages/` — every remaining
  hit is either in the disposition table, a changelog, or a file explicitly marked superseded.
- Every `PRO-*` ID appears exactly once as a definition and is referenced by ≥ 1 acceptance criterion.
- The spec contains zero unqualified « anonyme » and zero digit-valued recipient counts.
- The words `match`, `mutual`, `mutuel`, `réciproque` appear only in the disposition table and
  retirement notes.
- `docs/README.md`'s traceability paragraph still describes a chain that resolves — an old ENV-* issue
  number leads a reader to the disposition table, not to nothing.

## Risks

- **Losing the calm requirements.** Six requirements survive that have nothing to do with matching.
  A clean-slate rewrite drops them by omission. The disposition table exists to make that impossible —
  write it before the spec body, not after.
- **Authoring past the gate.** OQ-PRO-6 is genuinely unsolved. Writing the post-acceptance section on
  a guess produces a spec that reads finished and is wrong, which is worse than an empty section.
  If the founder is unavailable, ship the rest and leave that section as an explicit `⚠️ BLOCKED ON
  OQ-PRO-6` stub.
- **PR size.** This is comfortably a 400+ line change if the schema, the API implementation, and the
  spec-kit regeneration ride along. They must not (steps 4 and 5 are handoffs, not work).
- **Renumbering rot.** Any ENV-* citation left without a forwarding entry silently rots. The two greps
  above are the guard.
