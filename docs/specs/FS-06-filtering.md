# FS-06 — Send-time Filtering Rules (Paramètres de filtrage)

**Status:** Approved · **Agents:** iOS + Android (rule authoring UI + evaluation) + Backend (rule storage) · **Depends on:** FS-03 (état/ressenti), FS-07 (ADR-001 storage/sync model), feeds FS-05 · **Blueprint:** `swab - Paramètres modaux (standalone)`

## Purpose

« L'état et le ressenti ne forment pas les portées — ils filtrent au moment d'envoyer. » Default rules per sensitive case, three levels each, always visible at send time: « rien ne disparaît en silence ».

## The three levels (normative semantics)

| Level | FR | Behavior at send |
|---|---|---|
| **L1 — Veto absolu** | « jamais inclus, même forcé » | Excluded from resolution; does NOT appear in the revocable filtered list; not overridable in the send flow. The only silent-looking filter — but it's user-authored, so law 2 holds. |
| **L2 — Exclu par défaut** | « révocable à l'envoi » | Excluded by default; shown in the « Filtrés par tes règles » list with the rule named; one tap re-includes for THIS envie only. |
| **L3 — Priorité basse** | « inclus, en retrait » | Included in recipients; rendered de-emphasized in the **sender's** review list. Priority is presentational and never leaves the sender's view: recipients receive a flat set with no ordering or weighting, and nothing in any API response to a recipient may reveal that a rule de-emphasised them (IDT-08). |

## Functional requirements

| ID | Requirement |
|---|---|
| FLT-01 | Rules are defined per *case* — an (axis, value) condition, e.g. état = `paused` (« en pause ») — with one of the three levels. The stored `value` is the FS-03 FCH-09 **identifier**, never the French label, so a copy change can never orphan a user's rules. Defaults ship for sensitive états (blueprint example: Théo · en pause → L2 ⚠️ ASSUMPTION for other defaults). |
| FLT-02 | L1 semantics are absolute: never in resolution output, never overridable at send, never surfaced in the FS-05 revocable list. |
| FLT-03 | L2 exclusions appear at send with the causing rule visible per person; re-inclusion is per-envie and never mutates the standing rule (« Ces règles s'appliquent par défaut… te laisse forcer l'inclusion »). |
| FLT-04 | L3 members are in the final recipient set; de-emphasis is purely presentational and local. |
| FLT-05 | The settings surface shows a live preview of a concrete effect (blueprint: « Aperçu sur Théo · en pause ») so the user sees what a rule does to a real contact before saving. |
| FLT-06 | Rules and levels are **stored server-side** (ADR-001) and written per-record (VLT-07). Evaluation stays a pure function — `applyFilters(members, axes, rules) → {included, filtered:[{contact, rule}], lowPriority}` — implemented as a UI-framework-free domain module on each platform (`apps/ios` Swift / `apps/android` Kotlin) so the send-time review works offline from cached rules (resolution runs on-device — ENV-05, OQ-FLT-2). Both implementations are behaviour-locked by the same shared cross-platform test vectors; a new vector file is needed — `docs/migration/vault-test-vectors.json` is historical (ADR-001) and MUST NOT be extended. |
| FLT-07 | Per-contact overrides are possible on top of case rules (fiche-level exception), contact rule wins over case rule; precedence documented and property-tested. |
| FLT-08 | Changing a rule takes effect on the NEXT emission; active envies are never retroactively re-resolved. |

## Acceptance criteria (key)

- **Given** a contact with état `en pause` under the default L2 rule, **when** emitting to a scope containing them, **then** they appear under « Filtrés par tes règles » with the rule label, and one tap moves them to « Inclus ».
- **Given** an L1 veto on contact X, **when** emitting to any scope containing X, **then** X appears nowhere in the review UI and not in `recipientIds` — including after any UI manipulation (attempted force must be impossible, not just hidden).
- **Given** any rule change, **when** it is made offline, **then** it queues and replays exactly once on reconnect (VLT-07/VLT-10), and takes effect on the next emission only (FLT-08).
- **Given** an L3 de-emphasised recipient, **when** that recipient's client fetches anything about the envie, **then** no response field, ordering, or timing distinguishes them from a normally-included recipient (L3 semantics, IDT-08).
- Property test: for all inputs, `included ∪ filtered ∪ (L1-vetoed) = scope members`, sets disjoint — nobody is ever lost silently (law 2 as an invariant).

## Open questions

OQ-FLT-1: which (axis, value) cases ship with default rules besides `en pause` — Architect + Hamza; the mechanism must not hardcode the case list.

OQ-FLT-2: **where scope resolution evaluates the rules** — on-device over cached rules, or server-side. Affects whether the evaluator must exist in TypeScript as well as Swift/Kotlin, and therefore how many implementations the shared test vectors must lock. **RESOLVED (2026-08-22) — on-device**, as a consequence of the FS-05 `ENV-05` correction of 2026-08-16; this entry records that outcome, it is not a fresh decision. Rationale: the server stores filter rules (FLT-06) but **not** subgroup *membership* — the lattice is derived on-device from cached tags and never persisted (SGR-07, OQ-SGR-2 resolved 2026-08-16, VLT-01) — so the server cannot resolve a portée on its own, and the filter evaluator has to run where the members are. This OQ's premise (« ENV-05 now permits either ») came from an earlier ADR-001 edit that ENV-05's own correction note retracts as having over-generalised from filter rules to membership. Downstream, settled: `applyFilters` has **exactly two implementations** — Swift (`apps/ios`) and Kotlin (`apps/android`); **no TypeScript evaluator**, and no server-side mirror (FLT-06 amended, Backend scoped to rule storage only). The shared cross-platform test vectors are **still required** and must lock those two implementations — and the vector file must still be a **new** one: `docs/migration/vault-test-vectors.json` is historical (ADR-001) and MUST NOT be extended. ⚠️ Revisit if the web client (`apps/web`) ever emits envies — the same caveat OQ-SGR-2 carries for FCA, since it would otherwise have to reimplement the evaluator in a third language.
