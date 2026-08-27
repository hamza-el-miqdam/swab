# ADR-002 — An envie is a proposition: directed, visible, and answered by a group

- **Status:** Accepted
- **Date:** 2026-08-27
- **Revised:** 2026-08-27, same day — commitments 3–5 (group privacy, disclosure, and the two-mode
  accept) were rewritten after the founder corrected the group model. The original text described
  groups as shared objects whose members see each other; that is void. Recorded here rather than
  silently overwritten because the first version was already pushed to `main`.
- **Decider:** Hamza (founder/product owner)
- **Supersedes:** product law 1 (« Mutual reveal only ») in `docs/product-overview.md`, and **only the four words « reveal is strictly mutual »** inside law 4 — the rest of law 4 (no other user sees your classement, links are one-directional per IDT-08, refusal is indistinguishable from silence) survives verbatim, as do laws 2, 3 and 5; G1(d) in `agents/_global-directives.md`; the app description in `CLAUDE.md`; FS-05 `ENV-02`..`ENV-05`, `ENV-08`..`ENV-12`, `ENV-17`, `ENV-20`; FS-04's « tu ne définis jamais un groupe à la main »
- **Resolves / dissolves:** FS-05 `OQ-ENV-1` (category taxonomy), `OQ-ENV-2` (expiry anchor), `OQ-ENV-3` (recipient subset check), and the `ENV-17` / `ENV-19` pending assumptions — all five presupposed a matching engine that will not be built

## Context

FS-05 is the core loop and has never been implemented. Reaching it on the roadmap (2026-08-27) meant
finally answering five parked product questions — the category taxonomy, the expiry anchor, the
recipient-list check, the recipient cap, and the history grain. Presenting those questions surfaced
that the founder's model of the product had diverged from the specs:

> « there is no matching. it's a proposition. p1 propose to p2 to have a coffée together at the range
> of time … p2 receive notification that p1 a envie de le voir, and can choose to respond … the
> proposition is open for 48h … pass 48h the proposition/envie dead »

The specs describe the opposite: an envie is broadcast silently to a *scope*, and no recipient learns
anything unless they independently expressed the same envie back (`ENV-08`), at which point both are
notified simultaneously. That mutual-reveal design was the product's founding idea — *removing the
social cost of asking*, per the tagline « Sans jamais avoir à demander ».

The divergence was raised explicitly, with the conflicting normative text quoted, and reaffirmed. This
ADR records the decision rather than the debate.

Later the same day the group half was corrected — the first draft had groups shared and visible to
their members, which was wrong:

> « when I create a group, it should stay private, visible only for him. until he propose an envi to
> the group … you will have 2 options to chose accept the envie without reveling your ID or accept
> and reveil your ID »

That correction is folded into commitments 3–5 and shrinks the pivot substantially: FS-04's privacy
requirements and G1(a) both survive intact.

## Decision

**An envie is a proposition.** It is directed at people who will see it, it names what is proposed and
when and where, and it is answered. Eight commitments:

1. **Propositions are visible to their recipients.** P1 proposes; P2 is notified that P1 « a envie de
   le voir ». There is no hidden state and no reciprocity precondition.
2. **Mutual contact is the eligibility rule.** You may only propose to someone who also has you in
   their contacts — « you can't express an envie to someone who don't know you ». Links remain
   individually private (IDT-08), but proposing requires both directions to exist.
3. **A group is private to the person who created it.** Creating a group, naming it, and adding or
   removing people are invisible to everyone but its owner — no notification, no membership list, no
   trace. FS-04's original « une portée est privée » property is therefore **preserved, not repealed**;
   only the *manual* construction of the group is new. Nobody ever learns they are in a group. They
   learn only that a proposition arrived.
4. **A proposition discloses its proposer, vaguely its size, and nothing else.** P2 is told that P1
   « a envie de te voir » and that a few other people are invited — deliberately **without a number**,
   to stay inside product law 5 (no counters). P2 never learns who the others are, how many there are,
   or that they form a durable group.
5. **Accepting is a two-mode choice, and its scope must be stated honestly.** P2 accepts either
   **without revealing their identity to the other recipients**, or **revealing it** — in which case
   their display name becomes visible to them. **The proposer always sees who accepted, in both
   modes**; the choice shields P2 from the other recipients, never from P1, and the UI copy must say
   exactly that rather than promising anonymity it does not deliver. Anonymity has **no expiry**: P2
   may stay unnamed through the whole convergence and up to the meeting itself. Revealing later is
   always available and is one-way — you cannot un-reveal to people who have already seen you.
6. **Three responses: accept, counter-propose, ignore.** A counter-proposal edits a parameter (time,
   place) and puts it back to the group. **There is no explicit decline** — being unavailable means
   letting it expire, and that must stay indistinguishable from not having seen it.
7. **Swab shows, it does not decide.** The app displays the group's responses so the group can converge
   on a time and place themselves. Swab never ranks options, never tallies a majority, and never locks
   in a choice on the group's behalf.
8. **The matching engine is not built.** Fully replaced, not kept as a second mode.

Expiry is unchanged: a proposition lives 48h and then dies silently, taking its notification with it.

The French wording above is **illustrative, not frozen**. Normative copy is set by the FS-05 rewrite
(spec-specialist); in particular « et quelques autres personnes » is a placeholder for whatever vague
formulation the spec settles on, and it must not resolve to a digit.

## What survives, and why it matters

The pivot removes mutual reveal but **not** the product's emotional contract. These stay binding:

- **Silence is never explained.** `ENV-11`'s guarantee is void in its old form — but its purpose is
  reinstated for the new model: ignoring a proposition must be indistinguishable from never having seen
  it, with no read receipts, no "vu", no delivery status, and no signal back to the proposer.
- **No visible refusal.** There is no decline button anywhere; expiry is the only exit, and it looks the
  same whether the recipient was uninterested, busy, or absent.
- **Calm by design (law 5) — untouched.** No counters, badges, streaks, or urgency. This is why
  commitment 7 chose "show, don't decide" over "suggest the best option", and why commitment 4 shows
  « quelques autres personnes » instead of a headcount. Law 5 needs **no amendment**.
- **Classification stays one-directional and private (IDT-08).** Intimité rings, rôles, état, and
  ressenti are never visible to another user — and since groups are owner-private (commitment 3),
  group membership does not become a side channel for them either.
- **No « X t'a ajouté », ever.** Creating a group or adding someone to one notifies nobody and is
  visible to nobody. The prohibition in G1(a) survives intact.
- **Phone numbers stay hashed (IDT-01)** and never appear in a proposition.
- **`Envie.verb` stays opaque server-side** — the ADR-001 forward-compatibility commitment holds even
  though `ENV-20`'s matching rationale is gone, because it is now the *content* of the proposition.

## Consequences

### Binding directives must be amended first — this blocks all implementation

`agents/_global-directives.md` G1(d) currently reads *"reveal stays strictly mutual — the server may
compute a match but must not disclose a one-sided envie to anyone."* That file is prepended to every
agent prompt and is the single source of truth for scope enforcement, so **until it is amended, every
agent is required to reject this work as a privacy violation.** Amend it, then run
`node scripts/render-agents.mjs` to propagate to `.github/` and `.claude/agents/`, then re-run
`/speckit-constitution` to resync `.specify/memory/constitution.md`. `CLAUDE.md`'s one-line app
description and its "Hard boundaries" section need the same treatment.

**Exactly one clause changes.** G1(a) — directional links, no « X t'a ajouté » notifications — and
G1(b)/(c) are all satisfied by commitments 3–5 and must be left alone; widening them is not part of
this pivot. The replacement for (d):

> reveal stays strictly mutual — the server may compute a match but must not disclose a one-sided
> envie to anyone.

becomes

> a proposition is directed and visible to its recipients (ADR-002), and its proposer is always named
> — but **silence is never explained**: ignoring a proposition must be indistinguishable from never
> having seen it, with no read receipts, no delivery status, no « vu », and no signal of any kind back
> to the proposer. There is no decline action anywhere; expiry is the only exit, and it looks identical
> whether the recipient was uninterested, busy, or absent. A recipient's identity is disclosed to the
> other recipients only by that recipient's own explicit choice.

### Specs

| Spec | Impact |
|---|---|
| `docs/product-overview.md` | Law 1 rewritten; law 4 loses four words (« reveal is strictly mutual ») and is otherwise untouched; laws 2, 3, 5 unchanged. §1 premise, §3 receiver role, and the `envie` / `portée` / `match` glossary entries all change — `portée` is no longer « toujours un sous-groupe, jamais un individu », since proposing to one person is now the base case. Normative French copy — spec-specialist only. |
| FS-05 | Rewritten end to end. Emission becomes proposition authoring (what / when / where); matching is deleted; the post-match loop (`ENV-13`/`ENV-14`) moves to the front and becomes the response model. New requirement IDs, since the semantics under `ENV-02`..`ENV-12` no longer hold. |
| FS-04 | **Amended, not rewritten** — the revision above shrank this considerably. A group stays *private to its owner*, exactly as the spec already says, so the privacy requirements survive verbatim. Two changes only: « tu ne définis jamais un groupe à la main » is void (groups become manual by default, with CRUD and membership), and FCA detection is demoted to an **opt-in suggestion** — « on dirait un groupe, le créer ? » — never an automatic grouping. |
| FS-06 | **Status uncertain — decide before scheduling it.** Filter rules existed to silently prune a broadcast scope. Proposing to a named group makes silent exclusion incoherent. It may survive only to feed FS-04's suggestions, or be deferred. |
| FS-07 | Unaffected in substance. Gains the mutual-contact eligibility check and **one user-level display-name field** — generated by default, editable by its owner. The per-group override floated in the first draft is dropped: groups are owner-private, so there is no group context in which another member could see a different name. |
| FS-01/02/03 | Substantially unaffected. FCH-04's match-event history becomes a proposition-accepted event. |

### Schema (`area:db` — data-steward only)

- `Match` and `MatchState` become dead: nothing will ever write them. Remove.
- `EnvieRecipient` reshapes into proposition recipients **plus their response state**, and gains a
  per-recipient **`revealed`** flag (commitment 5). The read path must enforce that a non-revealed
  recipient is returned to the proposer but **never to the other recipients** — this is an
  authorization rule in the query, not a client-side filter.
- `Proposal` / `ProposalState` survive in spirit but move to the front of the flow and must carry
  counter-proposal lineage.
- **New:** `Group`, `GroupMember` — owner-scoped, never readable by a member (commitment 3) — a
  display name on the user, and time/place options on a proposition. Note the group is now a
  *template* for choosing recipients: the proposition's recipient set is what matters, and no API
  response may ever tell a recipient which group they came from.
- Still outstanding from before, and now more important: **no outbox table exists**, and the delta-pull
  cursor still needs the monotonic `bigserial` sequence already requested.

### Roadmap

`docs/ROADMAP.md` Phase 3 is invalidated. The FS-07 → FS-04 ∥ FS-06 → FS-05 critical path no longer
holds, and the observation that the FS-05 backend could start in parallel (which depended on `ENV-05`)
is void. Re-sequence after the spec rewrites. **Phase 1 (the IDT-03 trust-proxy security fix) is
completely unaffected and remains the highest-priority work.**

## Open questions

| ID | Question |
|---|---|
| OQ-PRO-1 | How does the API refuse a proposition to a non-mutual contact **without leaking** that the recipient hasn't added the proposer? Accept-and-silently-drop, or an explicit error? An error re-creates exactly the disclosure IDT-08 exists to prevent. |
| OQ-PRO-2 | Counter-proposal semantics: does a counter **replace** the original option or add a parallel one? How many can coexist before the group can no longer read the thread? |
| OQ-PRO-3 | Does a group proposition still die at 48h once some members have already accepted? What happens to agreement already given — is a partially-agreed proposition lost? |
| OQ-PRO-4 | Largely dissolved by commitment 3 — a private group is administered by its owner alone, nobody can leave what they don't know they're in, and removal notifies no one. What remains: may a *recipient* opt out of future propositions from a given proposer, and how, without that being a visible decline? |
| OQ-PRO-5 | Does a proposition still carry a `category`? Matching no longer needs one; FCH-04's relationship history may still want it. |
| OQ-PRO-6 | **Sharpened by commitments 4 and 5, and now the hardest open problem.** If Swab may not show a count per slot (law 5) and some accepters are anonymous, *what does a recipient actually see* that lets the group converge on a time and place? Named revealers alone? A qualitative cue? Nothing but the proposer's own summary? Answer this before FS-05 is written — commitment 7 says Swab must not decide, but the group still has to. |
| OQ-PRO-7 | Does FS-06 survive at all (see the spec table above)? |
| OQ-PRO-8 | Anonymity has no expiry (commitment 5), so a proposition can be accepted, agreed, and scheduled with participants nobody but the proposer can name. Is that the intended experience for the other recipients — and does the proposer get a way to say « je préfère que tout le monde se connaisse » without it becoming a decline-by-proxy? |
| OQ-PRO-9 | A recipient learns « quelques autres personnes » on every proposition from the same proposer. Does repeated exposure let them infer a stable group's existence and size over time, and does that matter? |

## Risks accepted

- **The differentiator changes.** Removing mutual reveal moves Swab from "an app where nobody has to
  ask" toward group scheduling, a category with established competitors. This was raised and accepted.
- **Refusal becomes partially visible.** Silence is still unexplained, but a proposer now knows they
  proposed — so a non-answer is perceptible in a way a non-match never was. Commitment 5 and the
  "silence is never explained" rule above are what keep this tolerable; they are not optional polish.
- ~~**Group membership exposes people to each other.**~~ **Retired by the 2026-08-27 revision.**
  Groups are owner-private and disclose nothing; a recipient is exposed to the others only by their
  own explicit choice (commitment 5). This was the pivot's largest privacy cost and it is now gone.
- **Anonymity is narrower than its name.** The proposer always sees who accepted. If the UI ever
  implies otherwise, the feature becomes a broken promise rather than a limited one — commitment 5's
  honesty requirement is the mitigation, and it is a copy review item, not a nice-to-have.
- **Convergence may be genuinely hard.** Law 5 forbids the counters that would make group scheduling
  easy, and commitment 5 lets people participate unnamed. OQ-PRO-6 is not a detail to settle during
  implementation; if it has no good answer, group propositions may need to be narrower than imagined.
