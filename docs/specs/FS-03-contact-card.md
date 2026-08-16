# FS-03 — Contact Card (Fiche contact)

**Status:** Implemented (iOS + Android native, 2026-07-10 — Wave 3, see `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`) · **Agents:** iOS + Android (sole) · **Depends on:** FS-02, FS-07 · **Blueprint:** `swab - Fiche contact (standalone) (1)`

## Purpose

Per-relation detail and editing: « Les quatre axes, éditables d'un tap — tu déclares, swab ne devine pas. » Below the axes, the relation's history and, when things have been static, « une invitation discrète à re-tagger ».

## User stories

- As a user, I edit any of the four axes (Intimité, Rôles·contexte, État, Ressenti) with a single tap per change.
- As a user, I see the relation's history feed — « seulement le fil de ce qui a bougé » — over the last 12 months.
- As a user whose tags are stale, I get a discreet re-tag invitation (« C'est toujours ça » / « À revoir plus tard »).

## Functional requirements

| ID | Requirement |
|---|---|
| FCH-01 | ⚠️ **Transitional (ADR-001).** The four axes render as tap-editable controls; every edit applies optimistically and works offline. Intimité's control offers the ring enumeration per ONB-04. *Current, and what the shipped code does:* the edit writes to the local vault and appends a history event locally. *After the ADR-001 migration:* the edit is a **per-record server write** (VLT-07) queued through the offline outbox (VLT-10) with a client mutation id, and the history event is created server-side. Optimistic UI and offline capability are unchanged either way — only where the write lands. |
| FCH-02 | Classification is asymmetric and private: nothing on this screen reflects how the other person classified the user. UI copy must never imply symmetry. |
| FCH-03 | Reciprocity signal, if shown, stays « volontairement doux » — qualitative, never numeric. No counters or metrics anywhere on the fiche (« Aucun compteur, aucune métrique »). |
| FCH-04 | History feed shows axis changes and relationship events (matches with this person, at coarse grain) over 12 months, newest first. Post-ADR-001 the feed is **server-stored and read through the cache**, and the 12-month window becomes a server-side retention policy rather than a device-side trim (match events per ENV-19; grain defined there — deferred until FS-05 lands). |
| FCH-05 | Staleness nudge: if no axis changed for a fixed period (6 months ⚠️ ASSUMPTION; a user-visible setting is deliberately out of scope — revisit only if testers ask for one), show the discreet prompt with exactly two actions: « C'est toujours ça » (re-confirms, resets timer) and « À revoir plus tard » (dismisses quietly, re-eligible after 30 days). Never a modal, never blocking. |
| FCH-06 | État values include at least the blueprint-attested `en pause`; the fiche shows the FS-06 filter consequence for the current état (e.g., "en pause → exclu par défaut à l'envoi") so filtering stays legible. |
| FCH-07 | Navigation: back to map preserving position (MAP-04 reverse transition). |
| FCH-08 | A contact who hasn't joined Swab yet (pending `ContactLink.targetId = null`) has a fiche too — axes fully editable; envie eligibility clearly indicated as inactive until they join. |

## Acceptance criteria (key)

- ⚠️ **Transitional (ADR-001).** *Current:* any axis edit produces only `POST /vault` (opaque blob) — this is what the shipped tests assert. *After the migration:* an axis edit produces a typed per-record write to the user's own account over TLS, and the classification values it carries appear in no log and in no other user's API response (VLT-03, IDT-08). Update this criterion, the platform tests, and `docs/qa/e2e-coverage.json` together in the migration PR.
- **Given** an axis edit offline, **when** connectivity returns, **then** it replays exactly once and reconciles without data loss (VLT-07 idempotency, VLT-09 field-level last-write-wins).
- **Given** the same contact edited on two devices — device A changes the ring, device B changes the ressenti — **when** both sync, **then** both changes survive (VLT-09 is field-level, not record-level).
- **Given** a stale relation, **when** « À revoir plus tard » is tapped, **then** no prompt reappears for 30 days, and the dismissal appears in no log (VLT-03/G3) — note it IS now stored server-side as ordinary state, which is what makes the 30-day timer survive a device change.

## Open questions

OQ-FCH-1: FS-03 shipped 2026-07-10 with placeholder vocabulary sets for Rôles·contexte and Ressenti. **RESOLVED (2026-08-09, issue #15):** final vocabularies extracted verbatim from the blueprint's embedded `ROLES`/`VALENCES` data (`blueprints/swab - Fiche contact (standalone) (1).html`, `Component extends DCLogic`). **Rôles·contexte** (multi-select, 6): famille, partenaire, collègue, promo, communauté, voisin. **Ressenti** (3, replaces the placeholder léger/précieux entirely): positive, ambivalente, négative. No real users existed yet to migrate, so this was a straight vocabulary swap, not a data migration. See `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`.

Note: the same blueprint source also shows État itself has a richer 5-value taxonomy (établi / à apprivoiser / en sommeil / en pause / tendu) versus the 3(+1, post-OQ-FCH-2) shipped today — that is a separate, already-tracked, still-open divergence (`docs/migration/rn-native-handoff.md` §5), not resolved by this OQ or by OQ-FCH-2.

OQ-FCH-2: Platform implementations flagged an état-vs-ressenti axis ambiguity for « en pause » in Wave 3 (see `docs/qa/e2e-coverage.json` FCH-06 note). **RESOLVED (2026-08-09, issue #16):** état is canonical, matching this spec's original position (FCH-06, FLT-01) unchanged — iOS and Android fixed to add `en pause` as a 4th état value and remove it from Ressenti (Ressenti now ships 2 values, still placeholder per OQ-FCH-1). See `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md` for the fix.
