# FS-04 — Subgroups (Sous-groupes)

**Status:** Approved · **Amended 2026-08-29** (`docs/decisions/ADR-002-envie-becomes-a-proposition.md`, commitment 3 — groups stay owner-private but become manual by default; FCA is demoted to an opt-in suggestion) · **Agents:** iOS + Android (group UI + on-device FCA over the local cache, see OQ-SGR-2) + Backend (owner-scoped `Group`/`GroupMember` storage, SGR-15a) · **Depends on:** FS-03 (tags), FS-07 (ADR-001 storage/sync model), feeds FS-05 · **Blueprint:** `swab - Sous-groupes (standalone)`

## Purpose

**Amended 2026-08-29** (`docs/decisions/ADR-002-envie-becomes-a-proposition.md`, commitment 3): a group is a named set of people **you** assemble yourself, private to you. Manual creation (SGR-10..SGR-13) is the primary path. Swab also offers detected candidates — « on dirait un groupe, le créer ? » — which the user may accept into a group of their own, rename, hide, or ignore (SGR-01, SGR-04, SGR-14); it never assembles a group without that acceptance. Both manually created and accepted-suggestion groups become the *portées* used by FS-05.

## User stories

- As a user, I create a group myself: name it, add whoever I choose from my contacts, and edit its membership whenever I want.
- As a user, I also see subgroups Swab suggests from my tags, split into Épinglés (pinned) and Détectés (detected) — I can pin, rename, hide, re-show, or accept any of them into a group of my own.
- As a user emitting an envie, I pick from my groups — manually created or accepted from a suggestion — as scopes.

## Functional requirements

| ID | Requirement |
|---|---|
| SGR-01 | Detection uses **formal concept analysis** over the user's tag data (rôles·contexte primarily; intimacy ring as an attribute), read from the local cache. Pure on-device function: `fca(contacts, tags) → conceptLattice`. Deterministic for identical input, and **identical across platforms** — same input must yield the same concepts in the same order on iOS and Android (SGR-09). Placement decided in OQ-SGR-2. **Amended (ADR-002):** the lattice's concepts surface as **suggested** subgroups only — « on dirait un groupe, le créer ? » — never as groups the user already has; the user accepts, renames, hides, or ignores each one (SGR-04, SGR-14). The computation itself is unchanged. |
| SGR-02 | Target proposal volume per blueprint: ~30 tagged contacts → typically 15–25 usable scopes. Degenerate concepts (singletons, near-universal sets) are pruned by documented rules. |
| SGR-03 | Hierarchy is preserved and rendered legibly: « un sous-groupe peut en contenir un autre ». |
| SGR-04 | **Amended (ADR-002) — scope narrowed to suggestions.** Operations on a **suggested** subgroup (FCA-derived, not yet accepted): **Épingler** (promotes to the pinned section, stable ordering), **Renommer** (label only — membership untouchable while it remains a suggestion), **Masquer** (hides from lists and from FS-05 scope picker), **Réafficher** (restores hidden), **Accepter** (turns it into a manual group — SGR-14). A suggestion itself has no create, no delete, and no direct membership edit; those exist only for the manual group SGR-14 creates on acceptance. Manually created groups (SGR-10..SGR-13) carry none of these restrictions. |
| SGR-05 | Auto-generated names are derived from the shared attributes; renames are **user data persisted server-side** (ADR-001) via per-record writes (VLT-07) and survive re-detection. |
| SGR-06 | Re-detection runs after tag changes (debounced). Stability rule: a pinned subgroup whose defining concept still exists keeps identity (id, name, pin) across runs; if its concept dissolved, it's flagged « à revoir » — never silently dropped (product law 2 extended to structure). |
| SGR-07 | User-authored subgroup state — names, pins, hidden flags — is stored server-side and synced per VLT-07..10 (ADR-001; the pre-2026-08-16 rule that the server never sees subgroup structure is retired). The derived lattice is recomputed on-device from cached tags and is not itself persisted server-side (OQ-SGR-2). **Unchanged and still binding:** subgroup names and structure are never disclosed to any *other* user (IDT-08), and FS-05 discloses only resolved recipient ID lists to recipients — never the scope name or the filter reason. |
| SGR-08 | No counts displayed (« aucun comptage ») — a subgroup shows its member *names* (or sample), never "12 personnes". |
| SGR-09 | **Cross-platform parity is a hard gate, not an aspiration.** iOS and Android must produce byte-identical detection output for identical input. Enforced by a single shared vector file, `docs/specs/vectors/fca-test-vectors.json`, which is the SSOT: **both platforms load the same file** (committed once, never transcribed into per-platform fixtures) and each platform's unit suite fails if any vector mismatches. Both suites already run in CI (`ios-unit` / `android-unit`), so divergence cannot reach `main`. The file must exist and be reviewed **before** either platform starts implementing. To make identical output achievable, the following are normative — they are the places the two languages diverge by default: |
| SGR-09a | **Ordering.** Concepts are emitted sorted by extent size **descending**, then by the concept's canonical attribute-set label **ascending**. Never iterate a `Set`/`HashMap`/dictionary to produce output — both platforms sort explicitly before returning. |
| SGR-09b | **String comparison.** All label sorting and equality normalises to **Unicode NFC first**, then compares by **Unicode code point**. Locale-sensitive collation is forbidden (it makes results depend on device language). Note the default APIs disagree: Kotlin's `String.compareTo` is UTF-16 code-unit order and Swift's `<` applies canonical equivalence — neither is code-point order, so both platforms need an explicit comparator. French labels make this live: « é » is U+00E9 in NFC but U+0065 U+0301 decomposed, and the two sort differently. |
| SGR-09c | **Arithmetic.** Pruning thresholds (SGR-02, OQ-SGR-1) use integer arithmetic only — no floating-point ratios, whose rounding differs across platforms and architectures. Express "at most half the circle" as `2 * size <= total`, never `size / total <= 0.5`. |
| SGR-10 | **New (ADR-002) — manual creation.** A user creates a group directly: choose a name, add members from contacts. No FCA step is required or implied; this is the default, primary path. The FS-04 v1 purpose statement's product law forbidding manual definition is retired by ADR-002 commitment 3. |
| SGR-11 | **New (ADR-002) — membership edit.** The owner may add or remove members of a manually created group at any time. Unlike SGR-04's suggestion-only actions, membership on a manual group is freely editable, not just its label. |
| SGR-12 | **New (ADR-002) — rename / delete.** The owner may rename a manual group's label, or delete the group entirely, at any time. Deleting a group does not retroactively withdraw propositions already sent from it — a proposition's recipient set is resolved at send time (ADR-002 schema note). |
| SGR-13 | **New (ADR-002) — owner-privacy invariant.** Creating a group, naming it, adding someone to it, removing someone, or deleting it is invisible to everyone but the owner. No notification, no membership list, no trace. Nobody ever learns they are in a group — they learn only that a proposition arrived. This restates ADR-002 commitment 3 and G1(a)'s « X t'a ajouté » prohibition, which the pivot preserves rather than repeals. |
| SGR-14 | **New (ADR-002) — accepting a suggestion.** Accepting a suggested subgroup (SGR-01, SGR-04) creates a new manual group, seeded with the suggestion's members and label as they stood at the moment of acceptance. From then on the group is ordinary: governed by SGR-10..SGR-13, editable independently of the lattice that suggested it, and carries no marker that FCA proposed it. Declining or ignoring a suggestion persists nothing (SGR-15). |
| SGR-15 | **New (ADR-002) — persistence split (normative, single source).** (a) Manually created groups — including ones created by accepting a suggestion (SGR-14) — are **server-persisted**, owner-scoped rows. Owner-scoping is an authorization rule enforced in the query layer, not a client-side filter: no endpoint may return a group, its name, or its membership to anyone but its owner. (b) The FCA-derived concept lattice itself (SGR-01, SGR-09 series) stays **on-device only** and is never persisted server-side or synced — `OQ-SGR-2`'s 2026-08-16 resolution is not reopened by this amendment. (c) These are different objects: a suggestion has no server row unless and until SGR-14 turns it into one. |

### Amendment note (ADR-002, 2026-08-29)

`SGR-07` and `SGR-08` above are unchanged by this amendment — ADR-002 commitments 3 and 4 re-confirm both: a group's structure is never disclosed to another user, and no subgroup or group ever shows a count. They are now also load-bearing for FS-05's recipient-facing copy rules (a proposition may state that a proposer exists and that a few others are invited, never a scope's name, size, or membership) — a future editor of either spec should not assume `SGR-07`/`SGR-08` are FS-04-only.

## Worked example (normative — the first parity vector)

Small enough to verify by hand, so it pins the ordering and naming rules before any code exists. This
example MUST appear as the first entry in `docs/specs/vectors/fca-test-vectors.json`.

Input context:

| | collègue | promo | famille |
|---|---|---|---|
| Ana | ✓ | ✓ | |
| Ben | ✓ | ✓ | |
| Chloé | ✓ | | |
| Dan | | | ✓ |

All formal concepts (five, including the two degenerate bounds):

1. `({Ana, Ben, Chloé, Dan}, {})` — top; no attribute is shared by everyone
2. `({Ana, Ben, Chloé}, {collègue})`
3. `({Ana, Ben}, {collègue, promo})`
4. `({Dan}, {famille})`
5. `({}, {collègue, promo, famille})` — bottom; no contact has all three

After SGR-02 pruning (drop the near-universal top, the empty bottom, and singletons), the **proposed
subgroups, in emission order per SGR-09a** are:

1. « collègue » — {Ana, Ben, Chloé} — extent 3
2. « collègue · promo » — {Ana, Ben} — extent 2, nested inside (1) per SGR-03

**Values in this example are French labels for readability; the algorithm consumes role *identifiers* (FS-03 FCH-09)** — `colleague`, `cohort`, `family` — and renders their labels only when naming the proposed subgroup. Both platforms must run FCA over identifiers, or two devices with the same relations would derive different lattices the moment a label is reworded. The forthcoming `docs/specs/vectors/fca-test-vectors.json` records the example in identifier form.

Note (2) is contained in (1): that containment is the lattice, and it is what SGR-03 renders. Neither
group here was created manually — both are FCA-derived suggestions the user may accept, rename, or
ignore (SGR-01, SGR-04).

## Acceptance criteria (key)

- **Given** the same cached tag state, **when** detection runs twice, **then** proposals are identical (SGR-01 determinism; property-based test).
- **Given** a pinned renamed subgroup, **when** an unrelated tag changes and re-detection runs, **then** the pin and name survive (SGR-06).
- **Given** a hidden subgroup, **when** opening the FS-05 scope picker, **then** it is absent.
- **Given** every vector in `docs/specs/vectors/fca-test-vectors.json`, **when** the iOS and Android suites each run it, **then** both produce the identical concept list in the identical order — including labels containing accented characters, which must sort the same on both (SGR-09/09a/09b).
- **Given** the worked example above, **when** detection runs on either platform, **then** it proposes exactly « collègue » (3 members) and « collègue · promo » (2 members), in that order.
- **Given** any subgroup operation (pin, rename, hide, re-show), **when** it is performed offline, **then** it queues in the outbox and replays exactly once on reconnect (VLT-07/VLT-10), and no other user's API responses change as a result (SGR-07, IDT-08).
- **Given** a manually created group, **when** any other user queries the API by any means, **then** no response ever contains that group's name, id, or membership (SGR-13, SGR-15a; owner-scoping is a query-layer authorization rule, not a client filter).
- **Given** a suggested subgroup, **when** the user taps « Accepter », **then** a new manual group is persisted server-side with the suggestion's current members and label, and the originating lattice concept remains un-persisted and unmarked (SGR-14, SGR-15).

## Non-functional

FCA on 150 contacts × ~40 attributes completes < 1s on mid-range hardware, off the UI thread — ⚠️ ASSUMPTION, not yet measured: a concept lattice can grow exponentially with overlapping attributes, so SGR-02's pruning is what keeps this bounded. Measure on the oldest supported device before treating the budget as met, and if it fails, tighten pruning (OQ-SGR-1) rather than moving work off-thread. Module is a pure, UI-framework-free domain module on each platform (`apps/ios` Swift / `apps/android` Kotlin), 100% unit-testable, deterministic per SGR-01, parity-locked per SGR-09, behavior-locked by shared cross-platform test vectors (ios/android specialist purity rules apply).

## Open questions

OQ-SGR-1: pruning thresholds (min size 2? max size relative to circle?) — Architect proposes defaults with the implementation; tune with real usage.

OQ-SGR-2: **where FCA runs, now that its inputs are server-side (ADR-001).** **RESOLVED 2026-08-16 — stays on-device**, computed over the local cache. Rationale: `fca()` is a pure deterministic function already behaviour-locked by shared cross-platform test vectors and the SGR-09 parity gate; running it on-device keeps the module UI-free and 100% unit-testable, keeps re-detection instant after a tag edit with no round-trip, and preserves the offline guarantee. Moving it server-side would add an endpoint plus a recompute trigger and buy nothing the product needs today. Only *user-authored* state (names, pins, hidden flags) is persisted server-side per SGR-05/SGR-07. ⚠️ Revisit if the web client (`apps/web`) ever needs subgroups, since it would otherwise have to reimplement FCA in a third language.

**Note (ADR-002, 2026-08-29): not reopened.** ADR-002 adds server-persisted `Group`/`GroupMember` rows for *manually created* groups (SGR-10..SGR-15), which is a different object from the FCA lattice this question resolves. The FCA lattice itself still stays on-device, never persisted, never synced. See SGR-15 for the full persistence split.
