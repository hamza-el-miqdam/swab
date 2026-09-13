# FS-06 — Standing Personal Boundaries (Veto absolu)

**Status:** Approved · **Agents:** iOS + Android (contact-card veto toggle + picker enforcement) + Backend (veto storage + server-side enforcement) · **Depends on:** FS-03 (contact card — veto affordance), FS-07 (ADR-001 storage/sync model), feeds FS-05 · **Blueprint:** `swab - Paramètres modaux (standalone)`

## Purpose

Narrowed 2026-09-13 per [ADR-002](../decisions/ADR-002-envie-becomes-a-proposition.md) `OQ-PRO-7`, outcome **(B)** — see
[SUG-SPEC-018](../../suggestions/done/specs/SUG-SPEC-018-adr002-fs06-survival.md). FS-06 used to describe silent,
rule-driven subtraction from a broadcast scope; ADR-002 replaced broadcast scopes with hand-assembled, owner-scoped
groups, which made that machinery incoherent — you cannot silently subtract someone from a list you just built
yourself, by hand, in the same session.

One clause survives, unchanged in substance: **veto absolu** — « jamais inclus, même forcé, invisible ». It is not a
filter on a broadcast; it is a standing personal boundary a user sets once, on a contact, and it holds across every
future group and proposal until the user removes it. FS-06 is now scoped to that boundary alone: its storage, its
enforcement, and the guarantee that it never leaks a signal to anyone.

## Veto absolu (normative semantics)

A veto is a boolean standing rule, per (owner, contact) pair, authored from the contact card (FS-03). When set: the
contact is excluded from every proposal the owner ever sends, in every group, forever — not overridable in the send
flow, not surfaced anywhere as a "filtered" or "revocable" item, and invisible to the vetoed contact and to every
other recipient. The only filter that still touches recipient resolution, and it is user-authored, so product law 2
("rien ne disparaît en silence") holds: nothing is hidden from the person who set the rule, only from everyone else.

## Functional requirements

| ID | Requirement |
|---|---|
| FLT-02 | L1 semantics are absolute: never in resolution output, never overridable at send, never surfaced in the FS-05 revocable list. |
| FLT-09 | Veto records are the single source of truth **server-side** (ADR-001; existing `FilterRule` storage, scoped to the L1/veto row only per this narrowing — retiring the now-unused L2/L3 columns is an `area:db` follow-up, not decided here). Enforcement is server-side and authoritative: at group-membership time and at every proposal-resolution/send, the server silently drops a vetoed contact from `recipientIds` before it ever reaches a response — mirroring the "silent accept-and-drop" pattern `OQ-PRO-1` established, and never trusting client state to have filtered correctly (G1). Clients proactively hide vetoed contacts from add-to-group and recipient pickers as a UX courtesy, but this is never the enforcement boundary — an attempted client-side bypass must be rejected server-side, not merely hidden client-side. A veto change (on or off) takes effect on the next proposal only; an in-flight or already-sent proposal is never retroactively re-resolved. This resolves `OQ-FLT-2` below and retires FLT-06's on-device `applyFilters` contract — there is no multi-level rule set left to resolve, so no offline evaluator is needed. |

## Acceptance criteria (key)

- **Given** a veto absolu on contact X, **when** X is a member of any group or a candidate recipient of any proposal, **then** X never appears in `recipientIds` returned to or accepted from the API, and no client picker offers X as selectable — including after any UI manipulation (a forced client-side bypass must be rejected server-side, not just hidden).
- **Given** a veto toggled on for a contact already in an existing group, **when** the next proposal is sent to that group, **then** the vetoed contact is silently absent from `recipientIds` and from every list surfaced to the proposer — no visible "1 fewer recipient" signal or count discrepancy anywhere (mirrors `OQ-PRO-1`'s silent accept-and-drop).
- **Given** a veto toggle change in either direction, **when** it is made, **then** it takes effect on the next proposal only; active/in-flight proposals are never retroactively re-resolved (carries FLT-08's guarantee forward).
- **Given** any attempt by a client to query or infer another user's veto list, **when** the API handles it, **then** no response field, ordering, or error message distinguishes a vetoed contact from one who was simply never a group member (IDT-08 — link direction stays private).

## Retired requirement IDs (FLT-\*)

| Old | Disposition | Note |
|---|---|---|
| FLT-01 | VOID | Case-based (axis, value) default-rule authoring is retired — veto absolu is a manual per-contact toggle, not derived from état/ressenti. |
| FLT-02 | Carries verbatim | Unchanged — see Functional requirements above. |
| FLT-03 | VOID | The L2 "excluded by default, revocable at send" tier is retired; there is no revocable tier left — a contact is either vetoed (never sent, ever) or not filtered at all. |
| FLT-04 | VOID | The L3 "included, de-emphasized" tier is retired along with the whole priority/level machinery. |
| FLT-05 | VOID | The live rule-effect preview UI existed to preview L1–L3 case-rule authoring; nothing is left to preview beyond a per-contact boolean toggle (covered by FS-03's contact-card affordance). |
| FLT-06 | VOID — replaced by FLT-09 | The on-device `applyFilters` pure-function contract (Swift + Kotlin, shared cross-platform test vectors) assumed multi-level rule resolution that no longer exists. Storage/enforcement mechanics for the single veto boolean are restated in FLT-09, server-side. |
| FLT-07 | VOID | Per-contact override "wins over case rule" precedence is meaningless once there are no case rules to override — veto absolu already *is* the per-contact record. |
| FLT-08 | Carries transformed — folded into FLT-09 | The non-retroactivity guarantee ("takes effect on the next emission only") is preserved in substance, restated as part of FLT-09 and its acceptance criteria rather than as a standalone requirement. |

## Open questions

OQ-FLT-1: **RETIRED 2026-09-13** — which (axis, value) cases ship with default rules besides `en pause`. Moot: the
case-based default-rule system (L1–L3 authored per état/ressenti value) is void per `OQ-PRO-7` (B); veto absolu is a
manual per-contact toggle with no case-derived defaults.

OQ-FLT-2: **where scope resolution evaluates the rules** — on-device over cached rules, or server-side.
**RE-RESOLVED 2026-09-13 — server-side**, superseding the 2026-08-22 on-device resolution below; the broadcast/lattice
model that resolution argued about no longer exists (ADR-002 — groups are server-side, owner-scoped, private
objects, not derived from cached tags). A veto is now a single boolean per (owner, contact) pair, stored and
enforced server-side (ADR-001), applying the same silent-drop pattern `OQ-PRO-1` established. There is no longer a
multi-level rule set that needs an offline-capable evaluator, so `FLT-06`'s on-device `applyFilters` contract is
retired (see disposition table) and no TypeScript/Swift/Kotlin evaluator triad is needed.

<details>
<summary>Superseded 2026-08-22 resolution (on-device) — kept for history, no longer in effect</summary>

Affects whether the evaluator must exist in TypeScript as well as Swift/Kotlin, and therefore how many
implementations the shared test vectors must lock. RESOLVED (2026-08-22) — on-device, as a consequence of the FS-05
`ENV-05` correction of 2026-08-16; this entry recorded that outcome, it was not a fresh decision. Rationale: the
server stored filter rules (FLT-06) but **not** subgroup *membership* — the lattice was derived on-device from
cached tags and never persisted (SGR-07, OQ-SGR-2 resolved 2026-08-16, VLT-01) — so the server could not resolve a
portée on its own, and the filter evaluator had to run where the members were. Downstream, settled at the time:
`applyFilters` had exactly two implementations — Swift (`apps/ios`) and Kotlin (`apps/android`); no TypeScript
evaluator, and no server-side mirror. This premise (portées derived on-device, no server-side membership) is exactly
what ADR-002 retired, which is why the resolution above supersedes it rather than merely amending it.

</details>
