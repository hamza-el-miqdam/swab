# FS-05 — Envie & Match Flow

**Status:** Approved · **Agents:** iOS + Android (flow UI, local resolution) + Backend (envies, matching, proposals) — the only two-agent spec; the API contract section is the seam. · **Depends on:** FS-04, FS-06, FS-07 · **Blueprint:** `swab - Flux envie et match (standalone)`

## Purpose

The core loop. Emission: « verbe → portée → filtrage transparent → envoi ». Reception: « une rencontre notifiée des deux côtés simultanément, sans "match !", sans compteur, avec une porte de sortie douce ».

## User stories

- As an initiator, I write what I want in the present tense (« envie de… », « comme tu le dirais à voix haute »), pick a portée, review exactly who's included vs filtered, override filters if I wish, and send.
- As a matched pair, we're notified at the same time and can propose a place, a time, or pass.
- As a receiver who isn't interested, I tap « Passer cette fois » and the other person never knows.

## Functional requirements — Emission (mobile)

| ID | Requirement |
|---|---|
| ENV-01 | Free-text verb input, present tense framing; client suggests a normalized `category` (⚠️ ASSUMPTION: category matching v0, product-overview §6). User can adjust the category suggestion. |
| ENV-02 | Scope picker lists FS-04 subgroups only — « Une portée, pas une personne ». No individual selection, no ad-hoc multi-select. |
| ENV-03 | Pre-send review shows the FULL resolution: **Inclus** list and **Filtrés par tes règles** list with the responsible rule level visible per person (FS-06). « Rien n'est masqué en silence. » (L1 veto-absolu members appear in neither list per FLT-02 — the review shows `scope members − L1`; the standing veto itself was user-authored, so law 2 holds.) |
| ENV-04 | Every default exclusion is revocable in place (« Tu peux réintégrer qui tu veux ») — except veto absolu, which appears nowhere in the review (FLT-02). |
| ENV-05 | Scope→recipients resolution MAY run server-side now that filter rules and subgroups are stored there (ADR-001, VLT-01). Wherever it runs, the resolved recipient list is authoritative, and neither scope names nor filter reasons are ever disclosed to recipients or to any other user (IDT-08). |
| ENV-06 | Post-send state is calm: « C'est parti, doucement. » No delivery status, no seen-by, no pending counter. Active envies are listed with a withdraw option. |
| ENV-07 | Envies expire (default 48h). Confirmation copy **« Elle expire dans 48 heures. »** frozen (SUG-DES-010, resolved 2026-08-09) — verbatim from the prototype's confirmation screen (`docs/design/swab-prototype-consolidated.html:524`). Expiry is invisible to recipients (they never knew). |

## Functional requirements — Matching (backend)

| ID | Requirement |
|---|---|
| ENV-08 | Match condition: envie E₁ (from A) and E₂ (from B) match iff B ∈ recipients(E₁) ∧ A ∈ recipients(E₂) ∧ category(E₁)=category(E₂) ∧ both ACTIVE and unexpired. |
| ENV-09 | Match creation is atomic and race-safe: computed inside one serializable transaction at envie creation; `@@unique([envieAId, envieBId])` arbitrates concurrent reciprocal creation — exactly one match per envie pair, ever. |
| ENV-10 | Notification fires to both parties in the same logical operation (outbox pattern) — no ordering where one side can observe the match meaningfully earlier. |
| ENV-11 | Non-matches are absolutely unobservable: no API response, timing signature, or push behavior may differ between "recipient hasn't reciprocated" and "recipient doesn't use the feature". |
| ENV-12 | A withdrawn (ENV-06) or expired envie can no longer produce matches; existing matches survive. |
| ENV-17 | `POST /envies` validates per G1 (never trust the client): `verb` ≤ 200 chars; `category` ∈ the v0 taxonomy (OQ-ENV-1); `recipientIds` non-empty, distinct, excludes the author, all reference existing users, and count ≤ N (⚠️ PROPOSED ASSUMPTION — pending Hamza's sign-off: N=150, the MAP-07 circle bound); `expiresAt` strictly within `(now, now + 48h]` (⚠️ PROPOSED ASSUMPTION — pending Hamza's sign-off, and pending OQ-ENV-2's 48h-vs-midnight resolution; the upper bound now equals ENV-07's confirmed 48h default per SUG-DES-010). Any violation → `422`, no partial creation. |
| ENV-18 | `idempotencyKey` is unique per author. Retrying `POST /envies` with a key already used by that author returns the original envie unchanged (`200`, not `201`) — never a duplicate envie, never a recomputed match, and never a second outbox notification (ENV-09 atomicity, ENV-10 notification-once — the retry path must not double-fire either). |
| ENV-20 | **Match compatibility MUST NOT depend on `verb` text** — it is computed from normalised `category` equality plus reciprocal recipients (ENV-08). `verb` is stored opaque to the schema: never split, normalised, indexed, or full-text-searched, and never read by any server-side feature (search, analytics, moderation, notification previews). This keeps ADR-001 option B — encrypting `verb` to matched parties only — reachable without a schema or API rewrite. Any proposal to match on verb semantics forecloses it and needs its own ADR. |

## Functional requirements — Post-match (both)

| ID | Requirement |
|---|---|
| ENV-13 | Match surface **in the OPEN state with no pending incoming proposal** offers exactly: **Proposer un lieu**, **Proposer une heure**, **Passer cette fois** — copy per blueprint (« Vous voulez vous proposer un truc ? »). **With a pending incoming proposal**, the surface instead offers exactly TWO actions: **Accepter la proposition**, and **Passer cette fois** — there is no separate "decline" action (OQ-ENV-5, resolved: swab has no refusal philosophy distinct from the soft pass — pass IS the decline mechanism, product-wide, per `docs/product-overview.md`'s glossary and product law 5; declining this specific proposal and passing on the match are the same user-facing action, carrying ENV-15's silent/bit-identical-to-counterpart semantics). Accept button copy **« Accepter la proposition »** frozen (OQ-ENV-4, resolved 2026-08-09, issue #19) — reuses "la proposition" verbatim from ENV-14's already-frozen "Envoyer la proposition" button, same verb+object pattern as the flow's other primary buttons. |
| ENV-14 | Proposals (place and/or time) go to the counterpart, who accepts or passes (no distinct decline action — ENV-15 semantics apply to a pass on a pending proposal same as any other pass). Accepted → match state SCHEDULED; passed → that side reaches PASSED (ENV-15), the counterpart's view/API responses remaining bit-identical to a still-open match. Simple single-proposal loop for POC — no negotiation threads. A proposal MUST carry at least one of {place, timeslot}; the API rejects an empty proposal (`422`). |
| ENV-15 | « Passer cette fois » sets PASSED for the passer only. The counterpart's views/API responses remain bit-identical to a still-open match (« qui ne dit rien à l'autre »); their side quietly reaches EXPIRED later (backend agent rule 3 test). |
| ENV-16 | No « match ! » celebration, no counters, ever (product law 5). Notification copy is soft — the blueprint's reference tone: « swab · à l'instant ». |
| ENV-19 | On a match, a coarse-grain relationship event is recorded for each matched contact — proposed grain: `{date, category}` only, **never the verb** ⚠️ PROPOSED ASSUMPTION (pending Hamza's sign-off) — feeding FCH-04 (`docs/specs/FS-03-contact-card.md`). Post-ADR-001 this history is server-stored and read through the cache; the event is written once per side, server-side, rather than appended by each client, so two devices cannot create duplicates. Excluding the verb is still required — not by the retired vault invariant, but by ENV-20 (verb stays opaque and unread by server-side features). |

## API contract (the Mobile↔Backend seam — OpenAPI is normative once generated)

`POST /envies` (verb, category, expiresAt, recipientIds[], idempotencyKey) → 201 · `DELETE /envies/:id` → withdraw · `GET /matches` · `POST /matches/:id/pass` · `POST /matches/:id/proposals` (place?, timeslot?) · `POST /proposals/:id/accept`. A pending proposal is passed via the existing `POST /matches/:id/pass` — no separate proposal-decline endpoint (OQ-ENV-5 resolved: pass is the only decline mechanism, product-wide).

## Acceptance criteria (key)

- **Given** users A and B mutually in scope with same-category active envies, **when** B emits, **then** exactly one match exists and both receive notification (integration + concurrency hammer test, DAT rule 5).
- **Given** A's envie including B, **when** B never reciprocates, **then** B's app state and network traces contain zero evidence of A's envie (ENV-11 — the product's foundational promise).
- **Given** B passed, **when** A polls `GET /matches`, **then** the response is byte-equivalent (identical field set and values; the ONLY permitted differences are server-clock response metadata — no entity field, including updatedAt-style columns, may change on the counterpart's side because of a pass) to the pre-pass response (ENV-15).
- **Given** a filtered contact revoked back in at send, **when** the envie is created, **then** they appear in `recipientIds` and the FS-06 default rule is untouched for future envies.

## Open questions

OQ-ENV-1: category taxonomy v0 (proposed: ~12 categories — sortir, manger, sport, ciné, parler, aider, jouer, voyager, boire un truc, se voir, travailler, autre) — Architect finalizes with Hamza.
OQ-ENV-2: default expiry 48h (ENV-07, confirmed) vs same-day-midnight semantics — the number is settled; whether the window is a fixed 48h rolling duration or anchored to a calendar-day cutoff is still open.
OQ-ENV-3: should `POST /envies` enforce `recipientIds ⊆ author's ContactLink targets` (FS-07 edges)? Enforcing it has privacy value (rejects recipient IDs the author has no server-visible relationship to); NOT enforcing it avoids the server ever learning "this recipient set is a subset of this author's links" at all — a real trade-off in both directions. Not decided here — Architect resolves with Hamza; implementers must not decide this implicitly by whichever behavior is easiest to write.
OQ-ENV-4: ENV-13's accept action (shown on a match with a pending incoming proposal) has no French button copy anywhere in the blueprints or specs — the "Flux envie et match" blueprint only covers the no-proposal state (« Vous voulez vous proposer un truc ? », **Proposer un lieu**, **Proposer une heure**). **RESOLVED (2026-08-09, issue #19):** button copy is **« Accepter la proposition »** — design-specialist proposed it (Penpot unreachable this session — OAuth needs an interactive session; the blueprint export was the only source checked), Hamza picked it from three candidates. Frozen into ENV-13. No prompt copy above the two buttons was requested — screen shows the bare **Accepter la proposition** / **Passer cette fois** pair.
OQ-ENV-5: does **Passer cette fois** remain available on the match surface while a proposal is pending (ENV-13)? **RESOLVED (2026-08-08, issue #20):** yes — and there is no separate "decline" action at all. Hamza: "there is not refusal philosophy of swab... there is not refusal when 2 people express a mutual envie." The pending-incoming-proposal surface offers exactly two actions, accept and **Passer cette fois**; declining a proposal and passing on the match are the same action, consistent with `docs/product-overview.md`'s existing glossary entry (« passer cette fois » = soft pass = "Declining a match invisibly to the counterpart") and product law 5. See ENV-13, ENV-14.
