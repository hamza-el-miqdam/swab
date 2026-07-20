# FS-02 — Relationship Map (Carte des relations)

**Status:** Implemented (iOS + Android native, 2026-07-10 — Wave 2, see `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`) · **Agents:** iOS + Android (sole) · **Depends on:** FS-01, FS-07 · **Blueprint:** `swab - Carte des relations (standalone)`

## Purpose

The app's home: a radial, at-a-glance view of « ton cercle, à l'instant » — « moi » at the center, contacts positioned on intimacy rings, readable entirely offline.

## User stories

- As a user, I open the app onto my map and see my circle without any loading dependency on the network.
- As a user, I read intimacy (ring distance), état, and rôles at a glance and tap any contact to open their fiche (FS-03).
- As a user, I reach the three main surfaces — Carte / Envie / Sous-groupes — from persistent navigation.

## Functional requirements

| ID | Requirement |
|---|---|
| MAP-01 | Radial layout: « moi » centered; each contact rendered on its declared intimacy ring. Ring semantics come from the vault; no server call is needed to render. |
| MAP-02 | Primary navigation exposes exactly: Carte, Envie (FS-05 entry), Sous-groupes (FS-04). No badges or unread counters on nav items. |
| MAP-03 | Contact visual encodes the axes non-textually where possible (ring = intimité; état variant per blueprint's A·chaud / B·froid treatments). Exact visual grammar per blueprint. |
| MAP-04 | Tap contact → « Ouvrir la fiche » → FS-03. Transition keeps spatial continuity (contact grows from its map position). |
| MAP-05 | Map renders fully offline from the vault. First paint from local data < 500ms on mid-range hardware. |
| MAP-06 | Empty/sparse states are calm: a nearly-empty map invites adding people without alarm or progress framing. |
| MAP-07 | Up to ~150 contacts render without jank (60fps pan/zoom); beyond the visible densities, rings cluster gracefully (design follows blueprint treatment). |
| MAP-08 | Accessibility fallback: a screen-reader-navigable list view grouped by ring, feature-equivalent for opening fiches. |
| MAP-09 | No global search, no sorting metrics, no "top friends" — discovery is spatial only (ethos law 5). |

## Acceptance criteria (key)

- **Given** airplane mode and a calibrated vault, **when** the app cold-starts, **then** the map is fully interactive with zero failed-request UI.
- **Given** a re-tag in FS-03 changing a ring, **when** returning to the map, **then** the contact is on the new ring with an animated (not teleported) transition.
- **Given** TalkBack active, **when** navigating the list fallback, **then** every contact is reachable and announces name + ring.

## Non-functional

The map is the most render-intensive surface: GPU/UI-thread animation on each platform (SwiftUI / Compose), no main-thread blocking work during gestures, contact nodes cheap to recompose (ios/android specialist performance rules apply).

## Open questions

OQ-MAP-1: exact clustering behavior past ~150 contacts — defer until real data; blueprint shows ≤ ~30.
