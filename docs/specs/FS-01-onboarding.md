# FS-01 — Onboarding & Relationship Calibration

**Status:** Implemented (iOS + Android native, 2026-07-10 — Wave 1, see `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`) · **Agents:** iOS + Android (lead), Backend (auth endpoints) · **Depends on:** FS-07 · **Blueprint:** `swab - Onboarding (standalone)`

## Purpose

Take a new user from install to a populated relationship map, establishing the privacy contract from the first screen. Ends on: « Voilà, c'est posé. Ta carte est prête. Personne — ni eux, ni nous — ne voit comment tu l'as remplie. »

## User stories

- As a new user, I sign up with my phone number and see the promise « Tout reste chiffré sur ton téléphone » before entering anything personal.
- As a new user, I add the people who matter (« Qui compte pour toi ? ») from contacts or manually, and can skip and return later.
- As a new user, I place each added contact on an intimacy ring around « moi » in a radial preview of my future map.
- As a new user, I may optionally tag état/ressenti — the layer is collapsed by default and skippable.

## Functional requirements

| ID | Requirement |
|---|---|
| ONB-01 | Welcome screen shows brand (swab · صواب), tagline, privacy promise, single CTA « Commencer ». No account creation before this screen is acknowledged. |
| ONB-02 | Phone-OTP signup per FS-07 (IDT-01…04). On success a device vault key is generated (FS-07) before any classification input is possible. |
| ONB-03 | Contact addition offers « Importer mes contacts » (permission-gated, hashed client-side per IDT-06) and manual entry. « Passer » skips with no penalty and no nag. |
| ONB-04 | Calibration is radial: « moi » center; dragging/tapping a contact assigns it to an intimacy ring. The layout must visually prefigure the FS-02 map. |
| ONB-05 | Rings, roles, état, ressenti are written to the local vault only. Zero classification data in any network request during onboarding (assertable in tests via network mock). |
| ONB-06 | État/Ressenti layer is optional, collapsed by default; skipping never blocks completion. |
| ONB-07 | Completion screen confirms privacy (« Personne — ni eux, ni nous… ») and CTA « Voir ma carte » lands on FS-02. |
| ONB-08 | Onboarding is resumable: killing the app mid-flow resumes at the same step from local state. |
| ONB-09 | No gamification: no progress percentages, no confetti, no "X contacts added!" counters. Step indication is positional only. |

## Acceptance criteria (key)

- **Given** airplane mode after OTP, **when** the user calibrates 5 contacts, **then** all placements persist locally and sync as an encrypted blob when connectivity returns — and no request other than `POST /vault` contains any calibration-derived field.
- **Given** contact import is denied at OS level, **when** the user continues manually, **then** the flow completes with identical capabilities.
- **Given** a completed onboarding, **when** the map opens, **then** every calibrated contact appears on the ring chosen during onboarding.

## Non-functional

Calibration interaction ≥60fps on a mid-range Android device; full flow completable in under 3 minutes with 10 contacts; VoiceOver/TalkBack path exists for ring placement (list-based fallback).

## Open questions

None blocking. (Identity assumptions tracked in product-overview §6.)
