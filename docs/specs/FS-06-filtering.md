# FS-06 — Send-time Filtering Rules (Paramètres de filtrage)

**Status:** Approved · **Agents:** Mobile (sole — rules live in the vault, applied at resolution) · **Depends on:** FS-03 (état/ressenti), feeds FS-05 · **Blueprint:** `swab - Paramètres modaux (standalone)`

## Purpose

« L'état et le ressenti ne forment pas les portées — ils filtrent au moment d'envoyer. » Default rules per sensitive case, three levels each, always visible at send time: « rien ne disparaît en silence ».

## The three levels (normative semantics)

| Level | FR | Behavior at send |
|---|---|---|
| **L1 — Veto absolu** | « jamais inclus, même forcé » | Excluded from resolution; does NOT appear in the revocable filtered list; not overridable in the send flow. The only silent-looking filter — but it's user-authored, so law 2 holds. |
| **L2 — Exclu par défaut** | « révocable à l'envoi » | Excluded by default; shown in the « Filtrés par tes règles » list with the rule named; one tap re-includes for THIS envie only. |
| **L3 — Priorité basse** | « inclus, en retrait » | Included in recipients; rendered de-emphasized in the review list. No server-side meaning (recipients are a flat set — law 4 forbids leaking priority). |

## Functional requirements

| ID | Requirement |
|---|---|
| FLT-01 | Rules are defined per *case* — an (axis, value) condition, e.g. état = `en pause` — with one of the three levels. Defaults ship for sensitive états (blueprint example: Théo · en pause → L2 ⚠️ ASSUMPTION for other defaults). |
| FLT-02 | L1 semantics are absolute: never in resolution output, never overridable at send, never surfaced in the FS-05 revocable list. |
| FLT-03 | L2 exclusions appear at send with the causing rule visible per person; re-inclusion is per-envie and never mutates the standing rule (« Ces règles s'appliquent par défaut… te laisse forcer l'inclusion »). |
| FLT-04 | L3 members are in the final recipient set; de-emphasis is purely presentational and local. |
| FLT-05 | The settings surface shows a live preview of a concrete effect (blueprint: « Aperçu sur Théo · en pause ») so the user sees what a rule does to a real contact before saving. |
| FLT-06 | Rules, levels, and their evaluation exist only on-device (vault). Evaluation is a pure function: `applyFilters(members, axes, rules) → {included, filtered:[{contact, rule}], lowPriority}`, implemented as a pure, UI-framework-free domain module on each platform (`apps/ios` Swift / `apps/android` Kotlin), behavior-locked by shared cross-platform test vectors (pattern: `docs/migration/vault-test-vectors.json`). |
| FLT-07 | Per-contact overrides are possible on top of case rules (fiche-level exception), contact rule wins over case rule; precedence documented and property-tested. |
| FLT-08 | Changing a rule takes effect on the NEXT emission; active envies are never retroactively re-resolved. |

## Acceptance criteria (key)

- **Given** a contact with état `en pause` under the default L2 rule, **when** emitting to a scope containing them, **then** they appear under « Filtrés par tes règles » with the rule label, and one tap moves them to « Inclus ».
- **Given** an L1 veto on contact X, **when** emitting to any scope containing X, **then** X appears nowhere in the review UI and not in `recipientIds` — including after any UI manipulation (attempted force must be impossible, not just hidden).
- **Given** any rule change, **when** inspecting traffic, **then** only opaque vault sync occurs (FLT-06).
- Property test: for all inputs, `included ∪ filtered ∪ (L1-vetoed) = scope members`, sets disjoint — nobody is ever lost silently (law 2 as an invariant).

## Open questions

OQ-FLT-1: which (axis, value) cases ship with default rules besides `en pause` — Architect + Hamza; the mechanism must not hardcode the case list.
