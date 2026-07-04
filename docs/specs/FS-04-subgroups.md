# FS-04 — Subgroups (Sous-groupes)

**Status:** Approved · **Agents:** Mobile (sole — FCA runs on-device) · **Depends on:** FS-03 (tags) · **Blueprint:** `swab - Sous-groupes (standalone)`

## Purpose

« swab repère les regroupements naturels de ton cercle — tu ne définis jamais un groupe à la main. » Detected subgroups become the *portées* used by FS-05. The user curates only: pin, rename, hide, re-show.

## User stories

- As a user, I see subgroups Swab detected from my tags, split into Épinglés (pinned) and Détectés (detected).
- As a user, I pin, rename, or hide any proposed subgroup — but can never create or edit membership manually.
- As a user emitting an envie, I pick from these subgroups as scopes.

## Functional requirements

| ID | Requirement |
|---|---|
| SGR-01 | Detection uses **formal concept analysis** over the vault's tag data (rôles·contexte primarily; intimacy ring as an attribute). Pure on-device function: `fca(contacts, tags) → conceptLattice`. Deterministic for identical input. |
| SGR-02 | Target proposal volume per blueprint: ~30 tagged contacts → typically 15–25 usable scopes. Degenerate concepts (singletons, near-universal sets) are pruned by documented rules. |
| SGR-03 | Hierarchy is preserved and rendered legibly: « un sous-groupe peut en contenir un autre ». |
| SGR-04 | User operations: **Épingler** (promotes to the pinned section, stable ordering), **Renommer** (label only — membership untouchable), **Masquer** (hides from lists and from FS-05 scope picker), **Réafficher** (restores hidden). No create, no delete, no membership edit (« aucune création manuelle »). |
| SGR-05 | Auto-generated names are derived from the shared attributes; renames are user data stored in the vault and survive re-detection. |
| SGR-06 | Re-detection runs after tag changes (debounced). Stability rule: a pinned subgroup whose defining concept still exists keeps identity (id, name, pin) across runs; if its concept dissolved, it's flagged « à revoir » — never silently dropped (product law 2 extended to structure). |
| SGR-07 | Everything in this module — lattice, names, pins, hidden flags — lives in the vault. The server never sees subgroup structure or names; FS-05 sends only resolved recipient ID lists. |
| SGR-08 | No counts displayed (« aucun comptage ») — a subgroup shows its member *names* (or sample), never "12 personnes". |

## Acceptance criteria (key)

- **Given** the same vault state, **when** detection runs twice, **then** proposals are identical (SGR-01 determinism; property-based test).
- **Given** a pinned renamed subgroup, **when** an unrelated tag changes and re-detection runs, **then** the pin and name survive (SGR-06).
- **Given** a hidden subgroup, **when** opening the FS-05 scope picker, **then** it is absent.
- **Given** any subgroup operation, **when** inspecting traffic, **then** only opaque vault sync occurs (SGR-07).

## Non-functional

FCA on 150 contacts × ~40 attributes completes < 1s on mid-range hardware, off the UI thread. Module is pure TS (`apps/mobile/src/domain/fca.ts`), 100% unit-testable, no React imports (mobile agent rule 4).

## Open questions

OQ-SGR-1: pruning thresholds (min size 2? max size relative to circle?) — Architect proposes defaults with the implementation; tune with real usage.
