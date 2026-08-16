# FS-04 — Subgroups (Sous-groupes)

**Status:** Approved · **Agents:** iOS + Android (sole — FCA runs on-device over the local cache, see OQ-SGR-2) · **Depends on:** FS-03 (tags), FS-07 (ADR-001 storage/sync model) · **Blueprint:** `swab - Sous-groupes (standalone)`

## Purpose

« swab repère les regroupements naturels de ton cercle — tu ne définis jamais un groupe à la main. » Detected subgroups become the *portées* used by FS-05. The user curates only: pin, rename, hide, re-show.

## User stories

- As a user, I see subgroups Swab detected from my tags, split into Épinglés (pinned) and Détectés (detected).
- As a user, I pin, rename, or hide any proposed subgroup — but can never create or edit membership manually.
- As a user emitting an envie, I pick from these subgroups as scopes.

## Functional requirements

| ID | Requirement |
|---|---|
| SGR-01 | Detection uses **formal concept analysis** over the user's tag data (rôles·contexte primarily; intimacy ring as an attribute), read from the local cache. Pure on-device function: `fca(contacts, tags) → conceptLattice`. Deterministic for identical input. Placement decided in OQ-SGR-2. |
| SGR-02 | Target proposal volume per blueprint: ~30 tagged contacts → typically 15–25 usable scopes. Degenerate concepts (singletons, near-universal sets) are pruned by documented rules. |
| SGR-03 | Hierarchy is preserved and rendered legibly: « un sous-groupe peut en contenir un autre ». |
| SGR-04 | User operations: **Épingler** (promotes to the pinned section, stable ordering), **Renommer** (label only — membership untouchable), **Masquer** (hides from lists and from FS-05 scope picker), **Réafficher** (restores hidden). No create, no delete, no membership edit (« aucune création manuelle »). |
| SGR-05 | Auto-generated names are derived from the shared attributes; renames are **user data persisted server-side** (ADR-001) via per-record writes (VLT-07) and survive re-detection. |
| SGR-06 | Re-detection runs after tag changes (debounced). Stability rule: a pinned subgroup whose defining concept still exists keeps identity (id, name, pin) across runs; if its concept dissolved, it's flagged « à revoir » — never silently dropped (product law 2 extended to structure). |
| SGR-07 | User-authored subgroup state — names, pins, hidden flags — is stored server-side and synced per VLT-07..10 (ADR-001; the pre-2026-08-16 rule that the server never sees subgroup structure is retired). The derived lattice is recomputed on-device from cached tags and is not itself persisted server-side (OQ-SGR-2). **Unchanged and still binding:** subgroup names and structure are never disclosed to any *other* user (IDT-08), and FS-05 discloses only resolved recipient ID lists to recipients — never the scope name or the filter reason. |
| SGR-08 | No counts displayed (« aucun comptage ») — a subgroup shows its member *names* (or sample), never "12 personnes". |

## Acceptance criteria (key)

- **Given** the same cached tag state, **when** detection runs twice, **then** proposals are identical (SGR-01 determinism; property-based test).
- **Given** a pinned renamed subgroup, **when** an unrelated tag changes and re-detection runs, **then** the pin and name survive (SGR-06).
- **Given** a hidden subgroup, **when** opening the FS-05 scope picker, **then** it is absent.
- **Given** any subgroup operation (pin, rename, hide, re-show), **when** it is performed offline, **then** it queues in the outbox and replays exactly once on reconnect (VLT-07/VLT-10), and no other user's API responses change as a result (SGR-07, IDT-08).

## Non-functional

FCA on 150 contacts × ~40 attributes completes < 1s on mid-range hardware, off the UI thread. Module is a pure, UI-framework-free domain module on each platform (`apps/ios` Swift / `apps/android` Kotlin), 100% unit-testable, deterministic per SGR-01, behavior-locked by shared cross-platform test vectors (ios/android specialist purity rules apply).

## Open questions

OQ-SGR-1: pruning thresholds (min size 2? max size relative to circle?) — Architect proposes defaults with the implementation; tune with real usage.

OQ-SGR-2: **where FCA runs, now that its inputs are server-side (ADR-001).** **RESOLVED 2026-08-16 — stays on-device**, computed over the local cache. Rationale: `fca()` is a pure deterministic function already behaviour-locked by shared cross-platform test vectors (SGR-01, non-functional section); running it on-device keeps the module UI-free and 100% unit-testable, keeps re-detection instant after a tag edit with no round-trip, and preserves the offline guarantee. Moving it server-side would add an endpoint plus a recompute trigger and buy nothing the product needs today. Only *user-authored* state (names, pins, hidden flags) is persisted server-side per SGR-05/SGR-07. ⚠️ Revisit if the web client (`apps/web`) ever needs subgroups, since it would otherwise have to reimplement FCA in a third language.
