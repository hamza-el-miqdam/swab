# Feature Specification: Envie & Match Flow

**Feature Branch**: `001-envie-match`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Envie & Match flow — the core loop of Swab. Source material: docs/specs/FS-05-envie-match.md (already approved). Emission, matching, and post-match proposal loop as detailed in that spec — see full text below."

**Source of truth**: `docs/specs/FS-05-envie-match.md` (Approved). This spec-kit artifact restates it in spec-kit's format for `/speckit-plan` and `/speckit-tasks` — it does not supersede FS-05. Original requirement IDs (ENV-01…ENV-16) are quoted alongside each FR below for traceability; if the two ever diverge, FS-05 is authoritative and this file must be re-synced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Express an envie with transparent resolution (Priority: P1)

A user wants to signal a present-tense desire ("envie de...") to a group of people without singling anyone out or risking an awkward direct ask. They pick one of their own subgroups as the audience, see exactly who would receive it and who is being filtered out (and why), optionally bring back someone who was excluded by default, and send.

**Why this priority**: This is the entire product's reason to exist — without emission there is no loop. It must work standalone even before any match ever occurs.

**Independent Test**: Can be fully tested by creating an envie against a subgroup and verifying the pre-send resolution screen and the post-send payload, with no dependency on a second user or a match ever happening.

**Acceptance Scenarios**:

1. **Given** a user with at least one detected subgroup, **When** they start a new envie, **Then** the scope picker offers only subgroups — never individual contacts and never an ad-hoc multi-select (ENV-02).
2. **Given** a chosen scope, **When** the pre-send screen renders, **Then** every member of the scope appears in either an "Included" or "Filtered" list, with the specific rule responsible for each filtered person shown (ENV-03).
3. **Given** a person filtered by a default (non-absolute) rule, **When** the user taps to override, **Then** that person moves to Included for this send; a person excluded by the absolute veto rule never shows an override control (ENV-04).
4. **Given** a completed send, **When** the network payload is inspected, **Then** it contains only verb, category, expiry, and final recipient user IDs — no scope name, no filter reasoning (ENV-05).
5. **Given** a sent envie, **When** the user views their own sent list, **Then** they see no delivery status, no seen-by indicator, and no pending counter — only a withdraw action (ENV-06).

---

### User Story 2 - Reciprocal match is created and both sides notified simultaneously (Priority: P1)

Two people have each expressed compatible envies that include one another. Neither knew the other had done so. The moment both conditions are true, both people are notified at the same time — and if only one side ever expresses interest, that person's action must never be detectable by the other, or by anyone inspecting the system from outside.

**Why this priority**: This is the product's central promise (mutual-only visibility) and its hardest correctness property. It cannot be deferred past an MVP — a leaky non-match is a trust-destroying defect, not a bug to patch later.

**Independent Test**: Can be fully tested with two seeded users and envies, independent of the emission UI or the post-match proposal flow — verify match creation, notification timing, and non-match unobservability directly against the matching logic and its API surface.

**Acceptance Scenarios**:

1. **Given** user A's active envie includes B, and B creates an active envie of the same category that includes A, **When** B's envie is created, **Then** exactly one match exists between A and B, even if this creation races with any other concurrent envie activity (ENV-08, ENV-09).
2. **Given** a match is created, **When** notifications are dispatched, **Then** both A and B are notified as part of the same logical operation, with no ordering that lets one reliably observe the match before the other (ENV-10).
3. **Given** A has an active envie including B, **When** B never creates a reciprocal envie, **Then** nothing in B's application state, API responses, or notification behavior differs from a world where A never expressed anything at all (ENV-11).
4. **Given** an envie is withdrawn or has expired, **When** a potential reciprocal envie is later created, **Then** no new match is produced from the withdrawn/expired envie — but any match that already existed is unaffected (ENV-12).

---

### User Story 3 - Propose a place or time, or pass silently (Priority: P2)

Once matched, two people need a lightweight way to actually meet — without turning the app into a chat product, and without either side ever being able to tell that the other declined.

**Why this priority**: This completes the loop into a real-world outcome, but the match's core guarantees (Story 2) must be correct first; the proposal mechanics are comparatively simple and can follow.

**Independent Test**: Can be fully tested against an already-existing match fixture, independent of how that match was produced — verify the three-action surface, the accept/decline behavior, and pass-invisibility.

**Acceptance Scenarios**:

1. **Given** an open match, **When** either side views it, **Then** exactly three actions are available: propose a place, propose a time, or pass — no other actions, no negotiation thread (ENV-13, ENV-14).
2. **Given** a proposal is sent, **When** the counterpart accepts it, **Then** the match moves to a scheduled state visible to both sides (ENV-14).
3. **Given** one side passes, **When** the counterpart later views the match or polls for it, **Then** their view is bit-identical (modulo timestamps) to a still-open match; the passer's own side reflects the pass immediately, and the counterpart's side only quietly reaches an expired state later with no signal that a pass occurred (ENV-15).
4. **Given** any match reaches a mutual or scheduled state, **When** the UI renders it, **Then** there is no celebratory animation, badge, or counter of any kind (ENV-16).

### Edge Cases

- What happens when both users emit reciprocal envies at almost the same instant? → Exactly one match must still be created (ENV-09); this is a first-class acceptance scenario above, not a rare corner case.
- What happens when a user withdraws an envie after a match already formed from it? → The existing match is unaffected; only future matching is blocked (ENV-12).
- What happens when a proposal is sent but the counterpart never responds? → Out of scope for this spec's acceptance criteria; treat as an open UX question rather than an assumption (see Assumptions).
- What happens when both sides pass on the same match? → Both sides individually reach an expired/passed state; neither side's pass may be inferable from the other's view (extension of ENV-15's symmetry requirement).
- What happens when a category has no reasonable match candidates at all? → No match is created; this is the normal "no reciprocity" case and must remain unobservable (ENV-11) — not surfaced as an error or empty state that implies anyone looked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to author an envie as free-text, present-tense phrasing, with the system suggesting a normalized category the user can adjust (ENV-01).
- **FR-002**: The scope picker MUST offer only the user's own detected subgroups as sending targets — never individual contacts, never an ad-hoc multi-select (ENV-02).
- **FR-003**: Before sending, the system MUST show the complete resolution of the chosen scope: every member as either Included or Filtered, with the specific responsible rule shown for each filtered member (ENV-03).
- **FR-004**: Every default-rule exclusion MUST be revocable in place at send time; an absolute-veto exclusion MUST NOT expose an override control (ENV-04).
- **FR-005**: Scope-to-recipient resolution MUST happen entirely on the user's device; the data that leaves the device for a send MUST be limited to verb, category, expiry, and final recipient user IDs (ENV-05). This is a privacy invariant, not a UX preference.
- **FR-006**: Post-send state MUST be calm: no delivery status, no seen-by indicator, no pending counter; the user MUST be able to withdraw an active envie (ENV-06).
- **FR-007**: Envies MUST expire automatically after a default period; expiry MUST be invisible to any would-be recipient (ENV-07).
- **FR-008**: The system MUST create a match if and only if two active, unexpired, same-category envies mutually include each other's author (ENV-08).
- **FR-009**: Match creation MUST be atomic and race-safe such that exactly one match is ever created per unique pair of envies, regardless of concurrent creation attempts (ENV-09).
- **FR-010**: Both matched parties MUST be notified as part of one logical operation, with no observable ordering advantage to either side (ENV-10).
- **FR-011**: The system MUST guarantee that a non-reciprocated envie is completely unobservable to its would-be recipient — no API response, timing signature, or notification behavior may differ from a world where no envie was ever sent toward them (ENV-11).
- **FR-012**: A withdrawn or expired envie MUST NOT produce new matches; matches already created from it MUST remain unaffected (ENV-12).
- **FR-013**: A matched pair MUST be offered exactly three actions on the match surface: propose a place, propose a time, or pass (ENV-13).
- **FR-014**: A proposal MUST support accept/decline by the counterpart; acceptance MUST move the match to a scheduled state. Multiple simultaneous negotiation threads are out of scope (ENV-14).
- **FR-015**: A pass MUST update the passer's own view immediately while leaving the counterpart's view/API responses bit-identical to a still-open match; the counterpart's side MUST only reach an expired state later, with no signal that a pass caused it (ENV-15).
- **FR-016**: The system MUST NOT present any celebration animation, badge, or counter at any stage of the match or proposal lifecycle (ENV-16).

### Key Entities

- **Envie**: One user's expressed desire — verb/category, expiry, and the final resolved recipient ID list. Does not carry scope name or filter reasoning. Belongs to exactly one author; may be withdrawn or may expire.
- **Match**: A pairing formed between exactly two envies whose authors mutually included each other with matching category, both active. Has a lifecycle: open → (proposal exchanged) → scheduled, or → passed/expired per side independently.
- **Proposal**: A place and/or time suggestion attached to an open match, sent by one side to the other; resolves to accepted (→ scheduled match) or declined.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of non-reciprocated envies remain undetectable by their would-be recipient across API responses, timing, and notifications, verified by adversarial audit/testing (traces ENV-11 — the product's foundational guarantee).
- **SC-002**: Under concurrent reciprocal envie creation, exactly one match is produced in 100% of race-condition test runs (traces ENV-09).
- **SC-003**: A user can review the full transparent resolution (included/filtered) and send an envie in under 30 seconds for a scope of up to 20 people.
- **SC-004**: Both matched parties receive their notification within the same short time window (target: within 1 second of each other) in 99% of match events, with no reliable ordering advantage measurable by either client.
- **SC-005**: 100% of passes remain invisible to the counterpart — no test or manual audit can distinguish a passed match from a still-open one from the counterpart's side alone (traces ENV-15).
- **SC-006**: Zero occurrences of any counter, badge, or celebratory element anywhere in the emission-to-match-to-proposal journey (traces ENV-16).

## Assumptions

- Category taxonomy v0 is a small fixed set (~12 categories, e.g. sortir, manger, sport, ciné, parler, aider, jouer, voyager, boire un truc, se voir, travailler, autre) pending final confirmation with the product owner (FS-05 OQ-ENV-1). Not reopened as a clarification here since a reasonable default already exists and is documented.
- Default envie expiry is a 24-hour rolling window from creation — FS-05's documented buildable default (ENV-07 ⚠️ ASSUMPTION). OQ-ENV-2 (24h vs same-day-midnight) **remains open with the product owner**; build behind an expiry-policy seam so switching semantics is not a rewrite (playbook §4 rule 6).
- The proposal loop is single-proposal-at-a-time for this POC — no multi-turn negotiation, no counter-proposals beyond accept/decline of the single active proposal (ENV-14).
- Unanswered proposals (no accept/decline from the counterpart) are out of scope for this spec's acceptance criteria; timeout/reminder behavior, if any, is a follow-up decision.
- This spec assumes FS-04 (subgroup detection) and FS-06 (filtering rules, including the absolute veto) are implemented and available as inputs — this feature does not re-specify them.
