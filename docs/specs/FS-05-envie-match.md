# FS-05 — Envie & Proposition Flow

**Status:** Approved · **Agents:** iOS + Android (flow UI, response actions) + Backend (propositions, eligibility, responses) — the only two-agent spec; the API contract section is the seam. · **Depends on:** FS-04, FS-06 (narrowed — see PRO-04), FS-07 · **Blueprint:** `swab - Flux envie et match (standalone)` — the name is stale vocabulary left over from the retired matching engine (content already targets the proposition model below); renaming the on-disk file is a design-specialist follow-up, out of this spec's scope (French copy illustrative except where marked frozen) · **Supersedes:** the matching-engine design below `## Retired requirement IDs`; rewritten whole per [ADR-002](../decisions/ADR-002-envie-becomes-a-proposition.md), gate cleared 2026-09-13.

## Purpose

The core loop, rewritten. There is no matching engine and no reciprocity precondition: a proposition is
**directed and visible to its recipients from the moment it is sent**. Emission: « verbe → à qui →
filtrage minimal → envoi ». Reception: « on te dit que quelqu'un a envie de te voir, tu réponds si et
comme tu veux, en silence si tu préfères ». Response: accept (with or without revealing your identity),
counter-propose a time/place, or do nothing — there is no visible decline, ever.

## User stories

- As a proposer, I write what I want in the present tense (« envie de… »), choose who receives it — one
  person directly, or a saved group as a shortcut for addressing several people at once — review the
  final recipient list, and send. Anyone who hasn't added me back is silently dropped from that list; I
  never learn who, or that anyone was.
- As a recipient, I'm told that someone « a envie de me voir » and, if it's a group proposition, that a
  few other people were invited — never how many, never who. I can accept without revealing my identity
  to the others, accept and reveal it, counter-propose a different time or place, or do nothing. If I'm
  not interested I tap « Passer cette fois », which just removes the card from my own view — it tells
  the proposer nothing.
- As a group of recipients converging on a plan, I see the names of anyone who accepted and revealed,
  plus a vague, non-numeric hint if others accepted without revealing. Swab never ranks the options or
  picks one for us.
- As a proposer, I always see who accepted, whether or not they chose to reveal to the others — the
  reveal choice only ever shields a recipient from the rest of the group, never from me.

## Functional requirements — Emission (mobile)

| ID | Requirement |
|---|---|
| PRO-01 | Free-text verb input, present-tense framing (« envie de… »), ≤ 200 chars. A proposition MUST also carry at least one of `{place, timeslot}` — the same at-least-one-of rule `PRO-20` applies to counter-proposals; the API rejects a proposition with neither with `422` (validated alongside the rest of `PRO-14`). |
| PRO-02 | The recipient list is the only target type. **Individual is the base case** — a proposer may address one person directly with no group involved. A saved FS-04 group is an optional convenience for populating the same list at once; it is not a separate API shape, and the server resolves it into the identical `recipientIds` shape `PRO-14` validates (OQ-PRO-11). |
| PRO-03 | A lightweight `category` is kept, **narrowly**: once a proposition is accepted, it categorizes the resulting relationship-history entry (`PRO-25`) in each participant's own private FCH-04 history view (`docs/specs/FS-03-contact-card.md`) — never anyone else's. It is never displayed as a field on the proposition itself (card, notification, or response surface) at send or receive time, and never used for delivery or eligibility (OQ-PRO-5). ⚠️ PROPOSED ASSUMPTION (pending Hamza's sign-off): a v0 set — *sortir, manger, sport, ciné, parler, aider, jouer, voyager, boire un truc, se voir, travailler, autre* — is proposed unchanged from the retired matching-era list, since narrowing the use does not require narrowing the set. |
| PRO-04 | Pre-send review shows every currently-included recipient (« rien n'est masqué en silence », product law 2) — **except** anyone excluded by the FLT-02 veto absolu, who appears in neither an included nor an excluded list, with no override control anywhere (unchanged FLT-02 semantics). No rule-level "filtered" column exists — FS-06's survival and shape are decided in [SUG-SPEC-018](../../suggestions/done/specs/SUG-SPEC-018-adr002-fs06-survival.md) (OQ-PRO-7, resolved: option B, FLT-02 survives verbatim, the rest is retired); this row states only the FS-05-facing effect. FLT-02's own definition and its server-side enforcement now live in FS-06 as `FLT-02` (unchanged) and `FLT-09` (the server-side veto-drop mechanism, mirroring `PRO-07`/`PRO-08`'s silent-drop pattern) — see `docs/specs/FS-06-filtering.md`. |
| PRO-05 | Post-send state is calm: « C'est parti, doucement. » No delivery status, no seen-by, no pending counter. Active propositions are listed with a withdraw option — **now doubly binding**, since it is the client half of the amended G1(d) silence clause. |
| PRO-06 | Propositions expire (default 48h). Confirmation copy **« Elle expire dans 48 heures. »** stays frozen (SUG-DES-010, resolved 2026-08-09), shown once to the proposer at send time only. Expiry is otherwise **fully silent**: while active, a recipient's proposition card carries no countdown, no "expires soon" badge, and no aging indicator of any kind; once it expires it simply stops appearing, indistinguishable — from that recipient's side — from the proposer never having sent it at all, and from the recipient having tapped « Passer cette fois » (`PRO-17`). No urgency signal exists anywhere in the flow (product law 5; ADR-002:79, "a proposition lives 48h and then dies silently"). |

## Functional requirements — Delivery, eligibility & validation (backend)

| ID | Requirement |
|---|---|
| PRO-07 | Eligibility is mutual contact: a proposition may only reach a recipient who also has the proposer in their own contacts (ADR-002 commitment 2). An ineligible recipient is **silently accept-and-dropped** — the call succeeds normally (`201`), the recipient is quietly excluded, and the proposer never learns who was dropped or that anyone was (OQ-PRO-1). No explicit-error variant exists or may be added. |
| PRO-08 | A recipient may silently mute a given proposer. Future propositions from a muted proposer are dropped for that recipient using the identical mechanism as `PRO-07` — indistinguishable, from the proposer's side, from non-response (OQ-PRO-4). |
| PRO-09 | Scope→recipients resolution for a group-sourced proposition runs **server-side**: `Group`/`GroupMember` rows are server-side and owner-scoped (`area:db`), so the server can and does resolve membership itself. This is an authorization rule enforced in the read/write path, not a client-side filter — a non-owner can never query a group's membership, and **no API response, to the proposer or to any recipient, ever names which group produced a recipient list**; the group is a template only (ADR-002 commitment 3, schema note). |
| PRO-10 | Notification delivery is one-way, to N recipients, via the outbox pattern — there is no "both sides notified simultaneously" guarantee to preserve, since there is no reciprocal match. |
| PRO-11 | **Ignoring a proposition is absolutely unobservable — the most important requirement in this file.** No API response, timing signature, or push behavior may differ between: a recipient who hasn't answered yet, one who opened it and did nothing, one who tapped « Passer cette fois » (`PRO-17`), one who muted the proposer (`PRO-08`), one who was silently dropped as ineligible (`PRO-07`), and one who doesn't use the app at all. This is the direct ancestor of the amended G1(d). |
| PRO-12 | A withdrawn or expired proposition can no longer be accepted or counter-proposed to; any acceptance already recorded before withdrawal/expiry is untouched and survives. |
| PRO-13 | Acceptances persist past the 48h expiry as a standing confirmed record. At 48h a proposition stops accepting **new** responses and counter-proposals — it does not retroactively void what was already accepted (OQ-PRO-3). |
| PRO-14 | `POST /propositions` validates per G1 (never trust the client): `verb` ≤ 200 chars; `category` ∈ the `PRO-03` v0 set if present; at least one of `place`/`timeslot` present (`PRO-01`); `recipientIds` (post server-side group resolution, `PRO-09`) non-empty pre-eligibility-filtering, distinct, excludes the author, all reference existing users, and count ≤ N (⚠️ PROPOSED ASSUMPTION: N=150, the MAP-07 circle bound); `expiresAt` strictly within `(now, now + 48h]` (⚠️ PROPOSED ASSUMPTION, still pending the 48h-window open question below). Any violation → `422`, no partial creation. |
| PRO-15 | `idempotencyKey` is unique per author. Retrying `POST /propositions` with a key already used by that author returns the original proposition unchanged (`200`, not `201`) — never a duplicate, never a second outbox notification. |
| PRO-16 | `verb` stays opaque server-side: never split, normalised, indexed, or full-text-searched, and never read by any server-side feature (search, analytics, moderation, notification previews) — even though the verb **is now shown to recipients by design**. The opacity requirement is about server-side processing only, never a confidentiality claim about display, and it keeps ADR-001 option B (encrypting `verb` to accepted recipients only) reachable without a schema or API rewrite. |

## Functional requirements — Response & convergence (both)

| ID | Requirement |
|---|---|
| PRO-17 | The response surface offers exactly four actions, always: **accept without revealing identity**, **accept and reveal identity**, **counter-propose** (a time and/or place), and **« Passer cette fois »**. `« Passer cette fois »` is a **local hide** — it removes the card from the recipient's own view only and sends nothing to anyone. It is explicitly **not** a decline action under the amended G1(d) (OQ-PRO-10); no other decline action exists anywhere in the flow. |
| PRO-18 | Both accept modes must state **to whom** identity is hidden: choosing not to reveal hides a recipient's identity from the **other recipients only** — **the proposer always sees who accepted, in both modes** (ADR-002 commitment 5). Copy must never use an unqualified « anonyme »; it must name what is and isn't hidden. |
| PRO-19 | Revealing is always available after an unrevealed acceptance and is **one-way** — a recipient cannot un-reveal to people who have already seen them. Anonymity has **no expiry**: a recipient may stay unrevealed through the whole convergence, up to the meeting itself (commitment 5; OQ-PRO-8 notes the founder may revisit this later — until then, none). |
| PRO-20 | Counter-proposals are a **parallel option, not a replace**: multiple live time/place options may coexist on one proposition, capped at **3**, and each recipient responds to whichever option they prefer (OQ-PRO-2). A counter-proposal, like the original, MUST carry at least one of `{place, timeslot}`; the API rejects an empty one with `422`. |
| PRO-21 | Recipients see a convergence view listing the display names of anyone who **revealed and accepted**, plus — only if unrevealed accepters exist — a single non-numeric line (e.g. « et d'autres personnes ont accepté »); **never a count, never a digit** (OQ-PRO-6, product law 5). The proposer's own view is unaffected by any of this — per `PRO-18` they always see everyone regardless of reveal choice. |
| PRO-22 | **Swab shows, it does not decide.** The app displays the group's responses so recipients can converge themselves; it never ranks options, never tallies a majority, and never auto-locks a time/place on the group's behalf (ADR-002 commitment 7). |
| PRO-23 | Every recipient's and the proposer's view/API responses remain bit-identical to what they would be absent any other single recipient's action, **except** through the deliberate convergence surface (`PRO-21`) — generalising the guarantee from "the counterpart" (there is no counterpart any more) to "the proposer and every other recipient". In particular, one recipient hiding a card (`PRO-17`) or accepting without revealing produces zero observable change anywhere but that recipient's own device and, where `PRO-21` applies, the vague non-numeric cue. |
| PRO-24 | No « match ! » celebration, no counters, ever (product law 5). Notification copy stays soft — reference tone: « swab · à l'instant ». |
| PRO-25 | On **acceptance** (not on send — there is no match to fire on), a coarse-grain relationship event is recorded for each accepting contact — proposed grain `{date, category}` only, **never the verb** ⚠️ PROPOSED ASSUMPTION (pending Hamza's sign-off) — feeding FCH-04. The event is written once, server-side, per accepting recipient, so two devices cannot create duplicates. Excluding the verb is required by `PRO-16`, not by any retired vault invariant. |
| PRO-26 | A **group proposition** — any proposition addressed to more than one recipient, whether via a saved FS-04 group or hand-picked individually chosen recipients (`PRO-02`; the distinction is invisible past resolution) — tells each recipient only that a proposition arrived and that a few other people were invited too. The count and the identity of the others are never disclosed (ADR-002 commitment 4). This is an accepted, not mitigated, residual risk: repeated propositions from the same proposer could let a recipient roughly infer a stable group's size over time (`OQ-PRO-9`) — no design change is made to reduce that risk. The exact French hint wording is not decided here — see `OQ-PRO-13`. |

## API contract (the Mobile↔Backend seam — sketch only, not binding; implementation is a separate `area:backend` issue)

The old seam (`POST /envies`, `GET /matches`, `POST /matches/:id/pass`, `POST /matches/:id/proposals`,
`POST /proposals/:id/accept`) loses everything under `/matches` — there is nothing left to match.
Sketched replacement, for the `area:backend` implementer to refine, not to treat as final:

`POST /propositions` (verb, category?, place?, timeslot?, expiresAt, groupId? | recipientIds[]?,
idempotencyKey) → `201` — exactly one of `groupId` or `recipientIds[]` is supplied; a `groupId` is
resolved server-side into the same `recipientIds` shape `PRO-14` validates (`PRO-02`, `PRO-09`) before
validation runs; the client never assembles a group's membership itself. `idempotencyKey` is mandatory
on every call, never optional (`PRO-15`). `place`/`timeslot`: at least one is required (`PRO-01`,
mirroring `PRO-20`'s counter-proposal rule); `422` if both are absent. `DELETE /propositions/:id` →
withdraw (author only, `PRO-05`).
`GET /propositions` → the caller's own sent and received propositions; the received-side shape must
satisfy `PRO-11`/`PRO-23`'s unobservability guarantees for every proposition the caller does *not* see a
response to. `POST /propositions/:id/respond` (`action`: `accept` | `accept-reveal` | `counter-propose`
| `hide`, plus `place?`/`timeslot?` required when `action` is `counter-propose`) → `200`/`201` — sketched
as one endpoint mirroring `PRO-17`'s four-way response set; `area:backend` may split it into several
endpoints instead, as long as `PRO-11`'s and `PRO-23`'s observability guarantees hold identically either
way. Whether `hide` needs a server round-trip at all (versus being purely local, per-device state) is
also undecided here — deciding it belongs to the `area:backend` issue, not this spec.

## Acceptance criteria (key)

- **Given** a proposer addresses a saved group, **when** the proposition is created, **then** the
  request and its server-side resolution are identical in shape to addressing the same people
  individually, and no response anywhere names the group (`PRO-02`, `PRO-09`).
- **Given** a proposer names a verb and an optional category and reviews before sending, **when** the
  review renders, **then** every included recipient appears, the FLT-02 veto absolu appears in neither
  list, and no rule-level "filtered" column exists (`PRO-01`, `PRO-03`, `PRO-04`).
- **Given** a proposer submits a proposition with neither `place` nor `timeslot` set, **when** the
  request is validated, **then** it is rejected with `422` — identically to an empty counter-proposal
  under `PRO-20` — and a proposition carrying at least one of the two is accepted (`PRO-01`, `PRO-14`).
- **Given** a sent proposition, **when** the proposer views their sent list, **then** no delivery
  status, seen-by indicator, or pending counter appears, and the confirmation copy reads exactly
  « Elle expire dans 48 heures. » (`PRO-05`, `PRO-06`).
- **Given** recipient B has not added proposer A back, **when** A sends a proposition including B,
  **then** the call returns `201`, B is silently excluded, and nothing in A's response, timing, or push
  behavior reveals that anyone was dropped (`PRO-07`, `PRO-14`).
- **Given** recipient B has muted proposer A, **when** A sends a new proposition including B, **then**
  B is dropped through the identical `PRO-07` mechanism — no distinguishable signal (`PRO-08`).
- **Given** a proposition addressed to N eligible recipients, **when** it is delivered via the outbox,
  **then** each recipient's delivery is independent — one recipient's delivery timing, response, or
  absence of response never affects whether or when any other recipient receives the same proposition
  (`PRO-10`).
- **Given** a group proposition (more than one recipient, `PRO-02`), **when** a recipient views it,
  **then** they see only that a proposition arrived and that a few other people were invited too — never
  a count, never the others' identities (`PRO-26`, ADR-002 commitment 4).
- **Given** B never opens or responds to a proposition, **when** any API response, push notification, or
  timing trace involving B is inspected, **then** it is indistinguishable from B not using the app, B
  having muted A, or B having tapped « Passer cette fois » (`PRO-11`, `PRO-17`, `PRO-23`) — the
  product's foundational promise, restated for the new model.
- **Given** a proposition withdrawn or past 48h, **when** a new response is attempted, **then** it is
  rejected, but any acceptance already recorded before that point remains a standing confirmed record
  (`PRO-12`, `PRO-13`).
- **Given** a recipient accepts without revealing, **when** the proposer views responses, **then** the
  proposer sees that recipient by name; **when** another recipient views the convergence surface,
  **then** they see only a non-numeric cue, never a count (`PRO-18`, `PRO-21`).
- **Given** an unrevealed acceptance, **when** that recipient later chooses to reveal, **then** the
  reveal becomes visible to the others and cannot be undone (`PRO-19`).
- **Given** two live counter-proposals already exist on a proposition, **when** a third recipient
  counter-proposes, **then** it is accepted up to the cap of 3, and an empty counter-proposal (`{}`)
  anywhere is rejected with `422` (`PRO-20`).
- **Given** several recipients have responded in different ways, **when** the group views the
  proposition, **then** swab displays the responses with no ranking, tally, or auto-selected outcome
  (`PRO-22`).
- **Given** a recipient accepts, **when** the acceptance is recorded, **then** exactly one relationship
  event is written for that contact (never duplicated across devices) with grain `{date, category}` and
  never the verb, and the stored `verb` is never split, indexed, or read by any server-side feature
  (`PRO-16`, `PRO-25`).
- **Given** any proposition state, **when** requests are replayed with an idempotency key already used
  by that author, **then** the original proposition is returned unchanged at `200`, never duplicated,
  never re-notified (`PRO-15`).
- **Given** any two recipients of the same proposition, **when** their views/API responses are compared,
  **then** no field differs because of the other's actions except through `PRO-21`'s convergence surface
  (`PRO-23`, `PRO-24`).

## Retired requirement IDs (ENV-* → PRO-*)

Every `ENV-*` ID below is retired from active use. This table is the forwarding address
`docs/README.md`'s traceability convention requires — an old `ENV-*` citation resolves here, never to
nothing.

| Old | Disposition | Note |
|---|---|---|
| ENV-01 | Carries (verb) / conditional (category) | Free-text present-tense verb survives whole as `PRO-01`. The `category` half survives narrowly as `PRO-03` (OQ-PRO-5). |
| ENV-02 | VOID | « Une portée, pas une personne » is retired. Replaced by `PRO-02` (OQ-PRO-11). |
| ENV-03 | Reframe → PRO-04 | Pre-send review survives as « rien n'est masqué en silence » (law 2); the rule-level « Filtrés par tes règles » column depends on FS-06's fate (OQ-PRO-7, resolved B — see [SUG-SPEC-018](../../suggestions/done/specs/SUG-SPEC-018-adr002-fs06-survival.md)). |
| ENV-04 | Reframe → PRO-04 | Same dependency as ENV-03; folded into the same row. |
| ENV-05 | VOID as written → PRO-09 | On-device resolution was justified by "the server doesn't store membership". Under ADR-002, `Group`/`GroupMember` **are** server rows (owner-scoped), so the server resolves. Rewritten as an authorization rule. |
| ENV-06 | Carries verbatim → PRO-05 | « C'est parti, doucement. » + no delivery status, no seen-by, no pending counter. Now doubly binding — the client half of G1(d)'s silence clause. |
| ENV-07 | Carries, minus one clause → PRO-06 | 48h default and the frozen « Elle expire dans 48 heures. » survive. The trailing "expiry is invisible to recipients" clause is void — recipients now know from the start. |
| ENV-08 | VOID | The match condition. The engine will not be built. |
| ENV-09 | VOID | `@@unique([envieAId, envieBId])` race arbiter — no pairs, no race. |
| ENV-10 | Reframe → PRO-10 | Outbox survives as a mechanism; "both parties in the same logical operation" is void — delivery is one-way, to N recipients. |
| ENV-11 | Carries, transformed — the most important one → PRO-11 | "Non-matches are absolutely unobservable" becomes "ignoring a proposition is absolutely unobservable". Direct ancestor of the amended G1(d). |
| ENV-12 | Carries, reworded → PRO-12 | Withdrawn/expired propositions can no longer be *accepted*; acceptances already made survive. |
| ENV-13 | Rewrite → PRO-17, PRO-18 | The action set changes to: accept-without-revealing, accept-and-reveal, counter-propose (parallel, capped — OQ-PRO-2), « Passer cette fois ». Frozen button copy for the old single accept action (`« Accepter la proposition »`, OQ-ENV-4) no longer applies cleanly to two accept modes — see `OQ-PRO-12` below. |
| ENV-14 | Reframe → PRO-20 | The single-proposal loop becomes N-parallel, capped at 3 (OQ-PRO-2) — "no negotiation threads" is superseded, not confirmed. The `422` on an empty proposal survives. |
| ENV-15 | Carries, generalised → PRO-23 | Bit-identical counterpart responses generalise from "the counterpart" to "the proposer and every other recipient". |
| ENV-16 | Carries verbatim → PRO-24 | No « match ! », no counters, ever. Law 5, untouched by ADR-002. |
| ENV-17 | Carries, adapted → PRO-14 | Server-side Zod validation (G1) survives entirely; the `recipientIds` clause is rewritten per OQ-PRO-11. N=150 stays ⚠️ PROPOSED. |
| ENV-18 | Carries verbatim → PRO-15 | `idempotencyKey` unique per author, retry returns the original `200`. The "never a recomputed match" sub-clause is dropped — nothing is computed. |
| ENV-19 | Reframe → PRO-25 | The relationship event fires on **acceptance**, not on match. Grain `{date, category}` stays ⚠️ PROPOSED. Never the verb. |
| ENV-20 | Carries, new rationale → PRO-16 | Verb stays opaque server-side. The verb is now shown to recipients by design — ENV-20/PRO-16 was never a confidentiality claim about display, only about server-side processing. |

Also retired, not part of the ENV numbering: `OQ-ENV-4` and `OQ-ENV-5`'s resolutions (button copy, pass
is the only decline mechanism) carry forward as frozen prior art — see the Open questions section below.

## Open questions

- **OQ-ENV-1** — *category taxonomy* — **narrowed and answered by OQ-PRO-5, not reopened in full.** The
  original question (a taxonomy for match compatibility) is dead along with the matching engine; the
  surviving narrow question (a taxonomy for history browsing only) is proposed in `PRO-03`, pending
  Hamza's sign-off on the specific list.
- **OQ-ENV-2** — default expiry 48h (`PRO-06`, confirmed) vs same-day-midnight semantics — **carries
  unchanged.** The number is settled; whether the window is a fixed 48h rolling duration or anchored to
  a calendar-day cutoff is still open. *(ADR-002's header summary lists this as "dissolved" along with
  the matching-engine questions; [SUG-SPEC-016](../../suggestions/done/specs/SUG-SPEC-016-adr002-fs05-rewrite.md)'s
  detailed disposition table — the specific, later analysis this rewrite follows — determined it does
  not depend on matching and carries it forward. Recorded here so a future reader sees both and isn't
  surprised by the apparent conflict.)*
- **OQ-ENV-3** — should `POST /propositions` enforce `recipientIds ⊆ author's ContactLink targets`
  (FS-07 edges)? **RESOLVED — yes, already answered by `PRO-07`.** `PRO-07`'s mutual-contact eligibility
  gate is bidirectional by construction: a recipient is only reachable if they have the proposer in
  their own contacts, and since a proposition is addressed from the proposer's own contact/circle in
  the first place, the same server-side check necessarily covers the proposer's side of the edge too.
  No separate `recipientIds ⊆ ContactLink targets` enforcement point is needed beyond `PRO-07`, which
  `PRO-14`'s validation already depends on. Agrees with ADR-002's header summary, which already listed
  this question as dissolved rather than carried. Issue [#183](https://github.com/hamza-el-miqdam/swab/issues/183)
  named `OQ-ENV-3` as an input `PRO-14`'s validation was waiting on — this resolution closes that input.
- **OQ-ENV-4** — **RESOLVED (2026-08-09, issue #19).** Old single-accept button copy was
  « Accepter la proposition ». Superseded in scope by `OQ-PRO-12` below, which covers the two-accept-mode
  surface this rewrite introduces.
- **OQ-ENV-5** — **RESOLVED (2026-08-08, issue #20).** There is no separate decline action anywhere;
  pass is the only decline mechanism, product-wide. This resolution's *substance* carries forward whole
  into `PRO-17` (« Passer cette fois » is the sole non-accept, non-counter-propose action) — only the
  specific two-action surface it described (accept / pass) is superseded by the new four-action set.
- **OQ-PRO-12** *(new, found drafting this rewrite)* — `ENV-13`'s frozen accept-button copy
  (« Accepter la proposition ») presumed one accept action. `PRO-17`/`PRO-18` now require two — accept
  without revealing, and accept and reveal — each needing its own honest, non-misleading button copy
  (`PRO-18`: never implying anonymity from the proposer). No French copy for either exists in the
  blueprints. design-specialist + Hamza to resolve before implementation, same process as OQ-ENV-4.
- **OQ-PRO-13** *(new, found fixing PR #184's review)* — `PRO-26` requires that a group-proposition
  recipient be told a proposition arrived and that others were invited too, without a count or names.
  No French hint wording exists yet for that line (ADR-002's « et quelques autres personnes » is
  explicitly illustrative, not frozen). ⚠️ OPEN — design-specialist + Hamza to resolve before
  implementation, same process as `OQ-PRO-12`.
