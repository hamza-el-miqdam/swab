# SUG-SPEC-006 — `POST /envies` has no server-side validation requirements (expiresAt bounds, recipientIds, idempotencyKey semantics)

- **Area:** specs
- **Topic:** requirements
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** ENV-05, ENV-07, ENV-08 (new IDs ENV-17+ proposed)

## Problem / Opportunity

FS-05's API contract (`docs/specs/FS-05-envie-match.md:48`) is `POST /envies (verb, category, expiresAt, recipientIds[], idempotencyKey) → 201`, and ENV-05 (`FS-05:25`) makes the client author the payload. G1 says "Never trust the client — including our own apps" (`agents/_global-directives.md`), but no requirement tells the backend agent what "valid" means:

- **`expiresAt` is unbounded.** ENV-07 (`FS-05:26`) gives "default 24h ⚠️ ASSUMPTION" but nothing caps a client-supplied `expiresAt` — a modified client could create a never-expiring envie that matches forever (ENV-08 only checks "unexpired", `FS-05:31`). No min/max window, no requirement to reject past dates.
- **`recipientIds` is unvalidated.** No requirement that recipients must exist, be distinct, be non-empty, exclude the author, or be bounded in count. FS-07's edges (`ContactLink`) exist server-side, yet nothing states whether `recipientIds ⊆ author's links` is enforced or deliberately NOT enforced (enforcing it has privacy value; not enforcing it avoids the server learning that "recipient set ⊆ links" — a real design decision that today would be made implicitly by whoever writes the route).
- **`idempotencyKey` appears only in the contract line.** No ENV requirement defines its semantics (same key + same author → return the existing envie? scope of uniqueness? retention window?). It cannot be tested because no behavior is specified.
- **`verb` has no length bound** — relevant because ENV verbs are the one free-text field the server stores (`swab-domain-spec.md:98`).

The spec-kit artifact inherits all of this (`specs/001-envie-match/spec.md:81-83`, FR-005/FR-007 restate ENV-05/07 without validation semantics).

## Implementation plan

1. In `docs/specs/FS-05-envie-match.md`, add rows to the Matching (backend) table:
   - `ENV-17 | POST /envies validates per G1: verb ≤ 200 chars; category ∈ the v0 taxonomy (OQ-ENV-1); recipientIds non-empty, distinct, ≠ author, all existing users, ≤ N (⚠️ PROPOSED ASSUMPTION: N=150, the MAP-07 circle bound); expiresAt within (now, now + 48h] (⚠️ PROPOSED ASSUMPTION pending OQ-ENV-2). Violations → 422, no partial creation.`
   - `ENV-18 | idempotencyKey is unique per author; retrying with the same key returns the original envie (200) and never creates a duplicate or recomputes matches.`
2. Mark whether `recipientIds ⊆ author's ContactLink targets` is enforced as an explicit **open question** `OQ-ENV-3` (add to FS-05 Open questions) — do NOT decide it; per playbook §7 it becomes a `question` issue for the Architect (privacy trade-off both ways).
3. Follow the playbook §7 assumption protocol for the two ⚠️ PROPOSED ASSUMPTION values (N=150, 48h cap): propose in the issue, and on approval add them to `docs/product-overview.md` §6 in the same PR.
4. Re-sync `specs/001-envie-match/spec.md`: add matching FR-017/FR-018 with the (ENV-17)/(ENV-18) traceability tags, and an Assumptions bullet for the caps.
5. Root `CHANGELOG.md` entry (`area:specs`); notion-liaison re-sync for FS-05.

## Tests & acceptance criteria

- Every field in the `POST /envies` contract line is now governed by at least one requirement ID (grep the contract fields against the FR tables).
- New IDs are quotable in backend test names (`test_ENV17_expiresAt_pastDate_rejected422`, `test_ENV18_idempotentRetry_returnsOriginal`) per playbook §4 rule 1.
- OQ-ENV-3 exists and is tracked; no code decision was smuggled in.

## Risks & gotchas

- FS-05 is unbuilt — landing this BEFORE `/speckit-plan`/`/speckit-tasks` run for 001-envie-match avoids re-planning; it is the cheapest moment.
- The concrete bounds (200 chars, N=150, 48h) are proposals needing Hamza's sign-off via the ⚠️ PROPOSED ASSUMPTION flow — do not present them as settled.
- ENV-18 interacts with ENV-09 atomicity (retry must not double-fire the outbox notification, ENV-10) — say so in the requirement's row so the backend test covers it.
