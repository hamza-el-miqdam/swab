# FS-05 — Envie & Match Flow

**Status:** Approved · **Agents:** Mobile (flow UI, local resolution) + Backend (envies, matching, proposals) — the only two-agent spec; the API contract section is the seam. · **Depends on:** FS-04, FS-06, FS-07 · **Blueprint:** `swab - Flux envie et match (standalone)`

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
| ENV-03 | Pre-send review shows the FULL resolution: **Inclus** list and **Filtrés par tes règles** list with the responsible rule level visible per person (FS-06). « Rien n'est masqué en silence. » |
| ENV-04 | Every default exclusion is revocable in place (« Tu peux réintégrer qui tu veux ») — except veto absolu (FLT-02), which never appears as revocable. |
| ENV-05 | Scope→recipients resolution happens entirely on-device. The send payload contains: verb, category, expiry, final recipient user IDs. No scope name, no filter reasons (product law 4). |
| ENV-06 | Post-send state is calm: « C'est parti, doucement. » No delivery status, no seen-by, no pending counter. Active envies are listed with a withdraw option. |
| ENV-07 | Envies expire (default 24h ⚠️ ASSUMPTION). Expiry is invisible to recipients (they never knew). |

## Functional requirements — Matching (backend)

| ID | Requirement |
|---|---|
| ENV-08 | Match condition: envie E₁ (from A) and E₂ (from B) match iff B ∈ recipients(E₁) ∧ A ∈ recipients(E₂) ∧ category(E₁)=category(E₂) ∧ both ACTIVE and unexpired. |
| ENV-09 | Match creation is atomic and race-safe: computed inside one serializable transaction at envie creation; `@@unique([envieAId, envieBId])` arbitrates concurrent reciprocal creation — exactly one match per envie pair, ever. |
| ENV-10 | Notification fires to both parties in the same logical operation (outbox pattern) — no ordering where one side can observe the match meaningfully earlier. |
| ENV-11 | Non-matches are absolutely unobservable: no API response, timing signature, or push behavior may differ between "recipient hasn't reciprocated" and "recipient doesn't use the feature". |
| ENV-12 | A withdrawn (ENV-06) or expired envie can no longer produce matches; existing matches survive. |

## Functional requirements — Post-match (both)

| ID | Requirement |
|---|---|
| ENV-13 | Match surface offers exactly: **Proposer un lieu**, **Proposer une heure**, **Passer cette fois** — copy per blueprint (« Vous voulez vous proposer un truc ? »). |
| ENV-14 | Proposals (place and/or time) go to the counterpart, who accepts/declines; accepted → match state SCHEDULED. Simple single-proposal loop for POC — no negotiation threads. |
| ENV-15 | « Passer cette fois » sets PASSED for the passer only. The counterpart's views/API responses remain bit-identical to a still-open match (« qui ne dit rien à l'autre »); their side quietly reaches EXPIRED later (backend agent rule 3 test). |
| ENV-16 | No « match ! » celebration, no counters, ever (product law 5). Notification copy is soft — the blueprint's reference tone: « swab · à l'instant ». |

## API contract (the Mobile↔Backend seam — OpenAPI is normative once generated)

`POST /envies` (verb, category, expiresAt, recipientIds[], idempotencyKey) → 201 · `DELETE /envies/:id` → withdraw · `GET /matches` · `POST /matches/:id/pass` · `POST /matches/:id/proposals` (place?, timeslot?) · `POST /proposals/:id/accept | /decline`.

## Acceptance criteria (key)

- **Given** users A and B mutually in scope with same-category active envies, **when** B emits, **then** exactly one match exists and both receive notification (integration + concurrency hammer test, DAT rule 5).
- **Given** A's envie including B, **when** B never reciprocates, **then** B's app state and network traces contain zero evidence of A's envie (ENV-11 — the product's foundational promise).
- **Given** B passed, **when** A polls `GET /matches`, **then** the response is byte-equivalent (modulo timestamps) to the pre-pass response (ENV-15).
- **Given** a filtered contact revoked back in at send, **when** the envie is created, **then** they appear in `recipientIds` and the FS-06 default rule is untouched for future envies.

## Open questions

OQ-ENV-1: category taxonomy v0 (proposed: ~12 categories — sortir, manger, sport, ciné, parler, aider, jouer, voyager, boire un truc, se voir, travailler, autre) — Architect finalizes with Hamza.
OQ-ENV-2: default expiry 24h vs same-day-midnight semantics.
