# Swab (صواب) — Product Overview

**Status:** Approved (derived from the six screen blueprints + Hamza's direction, 2026-07)

## 1. Vision

Swab connects people with their friends and loved ones by removing the social cost of asking. You propose something to people you choose — a group or individuals — and they always see it, and that it is you asking. What's optional is on their side: they can accept while revealing their own identity to the other people you invited, or without — never a choice about whether they see the proposition at all. No rejection is ever visible; no silence is ever explained. Tagline from the onboarding: **« صواب — jouer franc jeu. Dis ce dont tu as envie. À qui tu veux. Sans jamais avoir à demander. »**

**Where your data lives** (decided 2026-08-16 — `docs/decisions/ADR-001-server-side-classification-data.md`). Your relationship map belongs to your *account*, not to your phone. Change phone, lose it, or use two — sign in and everything is there, consistent, because the server holds the record and your devices hold a cache. We chose recoverability over operator-blindness deliberately: the previous design encrypted everything to a key that never left the handset, which meant a lost phone was a permanently lost map, and two phones could silently overwrite each other's edits.

The honest consequence: **Swab can technically read your classification data; other users never can.** Privacy here means privacy *from the people in your life* — which is the privacy this product actually exists to provide — and it is enforced by the product laws below, not by us being unable to look. We never claim end-to-end encryption.

## 2. The five product laws (non-negotiable, enforced in code review)

1. **A proposition is directed, never broadcast.** You propose to people you chose, and they know it is you. No one receives a proposition « de quelqu'un ».
2. **Nothing hidden silently.** Every filter applied at send time is shown to the sender and revocable in place. (« Rien n'est masqué en silence. »)
3. **You declare, Swab never guesses.** Relationship classification is user-declared, asymmetric, and private. No inference, no suggestions based on behavior.
4. **Privacy is structural, not a setting — but it is privacy *from other users*, not from us.** Revised 2026-08-16 (`docs/decisions/ADR-001-server-side-classification-data.md`): classification data is stored server-side and the service can technically read it, so the « ni eux, ni nous » promise no longer holds and must not be used. What is structural and unchanged: no other user ever sees your classement, links are one-directional (IDT-08), and refusal is indistinguishable from silence. Say this plainly — never imply end-to-end encryption.
5. **Calm by design.** No counters, badges, streaks, celebrations, urgency, or gamification. Soft language everywhere; graceful exits (« Passer cette fois ») that the other side never sees.

## 3. Personas

- **The initiator** — has a free evening, wants company without imposing: emits an envie to a scope, forgets about it unless it matches.
- **The receiver** — always sees the proposition and knows who is proposing (Law 1: the proposer is never hidden); can accept, counter-propose, or stay silent. Accepting is where a choice exists: the receiver reveals their own identity to the *other* recipients, or doesn't — the proposer always sees *who* accepted regardless, since the proposer already knows who they invited.
- **The curator** — the same user in a quiet moment: places contacts on intimacy rings, tags roles/state/feeling, pins or renames detected subgroups, tunes filter levels.

## 4. MVP scope

**In:** phone-OTP signup (⚠️ ASSUMPTION), contact import + invite, radial onboarding calibration, relationship map, contact card with 4 axes + history, on-device FCA subgroups (pin/rename/hide), 3-level filter rules, proposition emission with transparent filtering, silent pass, encrypted vault sync. Web = landing + invite + account only.

**Out (POC):** group envies (>2-person matches), chat/messaging, semantic verb matching, media, web relationship map, social graph suggestions, any analytics beyond aggregate page counts, monetization.

## 5. Glossary (normative)

| Term (FR) | English | Meaning |
|---|---|---|
| **envie** | proposition | A directed invitation you send to people you chose, naming what/when/where; answered by accept / counter-propose / silence |
| **portée** | scope | A set of potential recipients — a group or individuals; the proposer chooses |
| **carte des relations** | relationship map | Radial view: « moi » center, contacts on intimacy rings |
| **fiche contact** | contact card | Per-relation detail: 4 axes + history feed |
| **les quatre axes** | the four axes | Intimité (ring), Rôles·contexte, État, Ressenti — declared, private, asymmetric |
| **sous-groupe** | subgroup | FCA-detected cluster usable as a scope; pin/rename/hide only |
| **filtrage** | filtering | Send-time exclusion by rules: veto absolu / exclu par défaut / priorité basse |
| ~~**match**~~ | ~~match~~ | **RETIRE** — see [ADR-002](decisions/ADR-002-envie-becomes-a-proposition.md). No matching engine; mutual reveal is gone. The word still appears in the schema and older specs as a historical artifact. |
| **passer cette fois** | soft pass | Declining a proposition invisibly to the counterpart |
| **vault** | vault | On-device encrypted store of all classification data; server holds an opaque blob |

## 6. Standing assumptions (Hamza to confirm/override)

1. ~~**Privacy:** hybrid local-first~~ — **RESOLVED 2026-08-16 (ADR-001).** Classification data (axes, filters, subgroups, history) is server-side in Postgres; the database is the single source of truth and devices cache. Sync is per-record with server-assigned timestamps and field-level last-write-wins, not whole-state push. `Envie.verb` is kept opaque to the schema and excluded from matching so it can be encrypted later without a rewrite.
2. **Identity:** phone-number OTP; contact discovery via client-side-hashed numbers.
3. ~~**Match compatibility:** normalized client-suggested `category` equality (not semantic verb matching) for v0.~~ — **RESOLVED 2026-08-27 (ADR-002).** No matching engine is being built. Propositions are directed and always visible to their recipients; what a recipient chooses is whether to reveal their own identity to the *other* recipients, never whether the proposer sees the proposition or its response. Categories may survive as a browsing/suggestion affordance, but that is a future decision, not a current assumption.

## 7. Success signals for the POC

Qualitative only, in line with the ethos: testers complete calibration without abandoning; envies get emitted more than once per user (the ask-cost removal works); zero privacy-promise violations found in review; free-tier budgets hold.
