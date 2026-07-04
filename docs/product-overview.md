# Swab (صواب) — Product Overview

**Status:** Approved (derived from the six screen blueprints + Hamza's direction, 2026-07)

## 1. Vision

Swab connects people with their friends and loved ones by removing the social cost of asking. You say what you feel like doing ("j'ai envie de…"), choose *who could receive it* — a scope, never a person — and the other side learns about it **only if the desire is mutual**. No rejection is ever visible; no silence is ever explained. Tagline from the onboarding: **« صواب — jouer franc jeu. Dis ce dont tu as envie. À qui tu veux. Sans jamais avoir à demander. »**

## 2. The five product laws (non-negotiable, enforced in code review)

1. **Mutual reveal only.** A desire is invisible to its recipients until reciprocated. A non-match leaves zero observable trace on either side.
2. **Nothing hidden silently.** Every filter applied at send time is shown to the sender and revocable in place. (« Rien n'est masqué en silence. »)
3. **You declare, Swab never guesses.** Relationship classification is user-declared, asymmetric, and private. No inference, no suggestions based on behavior.
4. **Privacy is structural, not a setting.** Classification never leaves the device unencrypted; the server cannot read it (« ni eux, ni nous »). ⚠️ ASSUMPTION: hybrid local-first model (swab-domain-spec §2).
5. **Calm by design.** No counters, badges, streaks, celebrations, urgency, or gamification. Soft language everywhere; graceful exits (« Passer cette fois ») that the other side never sees.

## 3. Personas

- **The initiator** — has a free evening, wants company without imposing: emits an envie to a scope, forgets about it unless it matches.
- **The receiver** — learns of a shared envie only when it's already mutual; can propose place/time or pass silently.
- **The curator** — the same user in a quiet moment: places contacts on intimacy rings, tags roles/state/feeling, pins or renames detected subgroups, tunes filter levels.

## 4. MVP scope

**In:** phone-OTP signup (⚠️ ASSUMPTION), contact import + invite, radial onboarding calibration, relationship map, contact card with 4 axes + history, on-device FCA subgroups (pin/rename/hide), 3-level filter rules, envie emission with transparent filtering, mutual matching, both-sides notification, place/time proposal, silent pass, encrypted vault sync. Web = landing + invite + account only.

**Out (POC):** group envies (>2-person matches), chat/messaging, semantic verb matching, media, web relationship map, social graph suggestions, any analytics beyond aggregate page counts, monetization.

## 5. Glossary (normative)

| Term (FR) | English | Meaning |
|---|---|---|
| **envie** | desire | A present-tense want ("envie de…"), sent to a scope, matched mutually |
| **portée** | scope | A set of potential recipients — always a subgroup, never an individual |
| **carte des relations** | relationship map | Radial view: « moi » center, contacts on intimacy rings |
| **fiche contact** | contact card | Per-relation detail: 4 axes + history feed |
| **les quatre axes** | the four axes | Intimité (ring), Rôles·contexte, État, Ressenti — declared, private, asymmetric |
| **sous-groupe** | subgroup | FCA-detected cluster usable as a scope; pin/rename/hide only |
| **filtrage** | filtering | Send-time exclusion by rules: veto absolu / exclu par défaut / priorité basse |
| **match** | match | Mutual envie compatibility; notified both sides simultaneously |
| **passer cette fois** | soft pass | Declining a match invisibly to the counterpart |
| **vault** | vault | On-device encrypted store of all classification data; server holds an opaque blob |

## 6. Standing assumptions (Hamza to confirm/override)

1. **Privacy:** hybrid local-first (axes/filters/subgroups on-device; envies/matching server-side with minimal data).
2. **Identity:** phone-number OTP; contact discovery via client-side-hashed numbers.
3. **Match compatibility:** normalized client-suggested `category` equality (not semantic verb matching) for v0.

## 7. Success signals for the POC

Qualitative only, in line with the ethos: testers complete calibration without abandoning; envies get emitted more than once per user (the ask-cost removal works); zero privacy-promise violations found in review; free-tier budgets hold.
