# FS-01 — Onboarding & Relationship Calibration

**Status:** Implemented (iOS + Android native, 2026-07-10 — Wave 1, see `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`) · **Agents:** iOS + Android (lead), Backend (auth endpoints) · **Depends on:** FS-07 · **Blueprint:** `swab - Onboarding (standalone)`

## Purpose

Take a new user from install to a populated relationship map, establishing the privacy contract from the first screen. Ends on: « Voilà, c'est posé. Ta carte est prête. Personne — ni eux, ni nous — ne voit comment tu l'as remplie. »

## User stories

- As a new user, I sign up with my phone number and see the promise « Tout reste chiffré sur ton téléphone » before entering anything personal.
- As a new user, I add the people who matter (« Qui compte pour toi ? ») from contacts or manually, and can skip and return later.
- As a new user, I place each added contact on an intimacy ring around « moi » in a radial preview of my future map.
- As a new user, I may optionally tag état/ressenti — the layer is collapsed by default and skippable.

> ⚠️ **Pending copy replacement (ADR-001 stage 6).** Three strings in this spec promise end-to-end
> encryption and are now false: the user story's « Tout reste chiffré sur ton téléphone », and
> « Personne — ni eux, ni nous — ne voit comment tu l'as remplie » in the Purpose and in `ONB-07`
> (mirrored in `ONB-01`'s privacy promise and `docs/qa/e2e-scenarios.md`). They are deliberately left
> in place: French UI copy is normative and replacing it is a product decision for the founder +
> design, not an implementer's call. Replacements must satisfy `VLT-06` — they may promise that no
> *other user* sees the classement, never that we cannot.

## Functional requirements

| ID | Requirement |
|---|---|
| ONB-01 | Welcome screen shows brand (swab · صواب), tagline, privacy promise, single CTA « Commencer ». No account creation before this screen is acknowledged. |
| ONB-02 | Phone-OTP signup per FS-07 (IDT-01…03). On success a session is established (IDT-02) before any classification input is possible. *(Pre-2026-08-16 this step generated a device vault key; ADR-001 retired it — there is no vault key, and nothing else gates classification input.)* |
| ONB-03 | Contact addition offers « Importer mes contacts » (permission-gated, hashed client-side per IDT-06) and manual entry. « Passer » skips with no penalty and no nag. |
| ONB-04 | Calibration is radial: « moi » center; dragging/tapping a contact assigns it to an intimacy ring (4 rings: Très proche / Proche / Familier / Plus loin — the fixed enumeration shared by FS-02/FS-03/FS-04; see OQ-ONB-1 for resolution history). The layout must visually prefigure the FS-02 map. |
| ONB-05 | ⚠️ **Transitional (ADR-001).** *Current, and what the passing tests assert:* rings, roles, état, ressenti are written to the local vault only, with zero classification data in any network request during onboarding. *After the ADR-001 migration:* they are sent to the server as typed payloads and this requirement becomes "classification data is transmitted only over TLS to the user's own account, and never appears in logs or in any other user's responses." Update this row, `docs/qa/e2e-coverage.json`, and `ApiClientPrivacyInvariantTests.swift` together in the migration PR. |
| ONB-06 | État/Ressenti layer is optional, collapsed by default; skipping never blocks completion. |
| ONB-07 | Completion screen confirms privacy (« Personne — ni eux, ni nous… ») and CTA « Voir ma carte » lands on FS-02. |
| ONB-08 | Onboarding is resumable: killing the app mid-flow resumes at the same step from local state. |
| ONB-09 | No gamification: no progress percentages, no confetti, no "X contacts added!" counters. Step indication is positional only. |

## Acceptance criteria (key)

- **Given** airplane mode after OTP, **when** the user calibrates 5 contacts, **then** all placements persist in the local cache and sync to the server when connectivity returns (VLT-04), with no data loss and no duplicate placements on replay.
- **Given** contact import is denied at OS level, **when** the user continues manually, **then** the flow completes with identical capabilities.
- **Given** a completed onboarding, **when** the map opens, **then** every calibrated contact appears on the ring chosen during onboarding.

## Non-functional

Calibration interaction ≥60fps on a mid-range Android device; full flow completable in under 3 minutes with 10 contacts; VoiceOver/TalkBack path exists for ring placement (list-based fallback).

## Open questions

OQ-ONB-1: the Onboarding blueprint (`blueprints/swab - Onboarding (standalone) (1).html`, `INTIMACY` constant) defined **5** intimacy rings with labels `intime` / `proche` / `ami` / `lien faible` / `connaissance` (radii 34/55/78/102/130 — a single fixed constant, independent of the blueprint's unrelated treatment-A/B toggle), while both shipped native apps instead implement **4** rings with different labels — `Très proche` / `Proche` / `Familier` / `Plus loin` — sourced identically in `apps/ios/Sources/SwabCore/L10n/Fr.swift:153-156` (consumed by `apps/ios/Sources/SwabUI/Onboarding/CalibrateView.swift`) and `apps/android/app/src/main/kotlin/com/swab/android/l10n/Fr.kt:59-62` (consumed by `apps/android/app/src/main/kotlin/com/swab/android/ui/onboarding/CalibrateScreen.kt`). iOS and Android agree with each other — this was never a cross-platform bug. **RESOLVED (2026-08-09, SUG-SPEC-009, founder decision):** the shipped 4-ring enumeration — `Très proche` / `Proche` / `Familier` / `Plus loin` — is frozen as canonical. The blueprint's 5-ring model is the artifact that was wrong and gets corrected to match ship (design-specialist tracks the blueprint HTML fix separately); no retrofit of either app. ONB-04 now states the enumeration normatively; MAP-01 (FS-02) and FCH-01 (FS-03) cross-reference it. FS-04's SGR-01 (shared ring enumeration, SUG-SPEC-005 test vectors) can now depend on this fixed value. (Identity assumptions tracked in product-overview §6.)
