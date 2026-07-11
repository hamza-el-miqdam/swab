# FS-03 — Contact Card (Fiche contact)

**Status:** Implemented (iOS + Android native, 2026-07-10 — Wave 3, see `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`) · **Agents:** Mobile (sole) · **Depends on:** FS-02, FS-07 · **Blueprint:** `swab - Fiche contact (standalone) (1)`

## Purpose

Per-relation detail and editing: « Les quatre axes, éditables d'un tap — tu déclares, swab ne devine pas. » Below the axes, the relation's history and, when things have been static, « une invitation discrète à re-tagger ».

## User stories

- As a user, I edit any of the four axes (Intimité, Rôles·contexte, État, Ressenti) with a single tap per change.
- As a user, I see the relation's history feed — « seulement le fil de ce qui a bougé » — over the last 12 months.
- As a user whose tags are stale, I get a discreet re-tag invitation (« C'est toujours ça » / « À revoir plus tard »).

## Functional requirements

| ID | Requirement |
|---|---|
| FCH-01 | The four axes render as tap-editable controls; every edit writes to the vault immediately (optimistic, offline-capable) and appends a history event locally. |
| FCH-02 | Classification is asymmetric and private: nothing on this screen reflects how the other person classified the user. UI copy must never imply symmetry. |
| FCH-03 | Reciprocity signal, if shown, stays « volontairement doux » — qualitative, never numeric. No counters or metrics anywhere on the fiche (« Aucun compteur, aucune métrique »). |
| FCH-04 | History feed shows axis changes and relationship events (matches with this person, at coarse grain) over 12 months, newest first, sourced from the vault only. |
| FCH-05 | Staleness nudge: if no axis changed for a configurable period (default 6 months ⚠️ ASSUMPTION), show the discreet prompt with exactly two actions: « C'est toujours ça » (re-confirms, resets timer) and « À revoir plus tard » (dismisses quietly, re-eligible after 30 days). Never a modal, never blocking. |
| FCH-06 | État values include at least the blueprint-attested `en pause`; the fiche shows the FS-06 filter consequence for the current état (e.g., "en pause → exclu par défaut à l'envoi") so filtering stays legible. |
| FCH-07 | Navigation: back to map preserving position (MAP-04 reverse transition). |
| FCH-08 | A contact who hasn't joined Swab yet (pending `ContactLink.targetId = null`) has a fiche too — axes fully editable; envie eligibility clearly indicated as inactive until they join. |

## Acceptance criteria (key)

- **Given** any axis edit, **when** inspecting network traffic, **then** only `POST /vault` (opaque blob) occurs — no field-level classification data in any payload (product law 4).
- **Given** an axis edit offline, **when** connectivity returns, **then** vault sync reconciles without data loss (last-write-wins per FS-07 VLT rules).
- **Given** a stale relation, **when** « À revoir plus tard » is tapped, **then** no prompt reappears for 30 days and nothing is logged server-side.

## Open questions

OQ-FCH-1: exact vocabulary sets for Rôles·contexte and Ressenti (blueprint shows the axes but not full option lists) — Architect to extract with Hamza before implementation; placeholder taxonomies acceptable for the walking skeleton.
