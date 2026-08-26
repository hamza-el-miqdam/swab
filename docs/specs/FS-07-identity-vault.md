# FS-07 — Identity, Contacts & Vault Sync (foundation)

**Status:** In progress (identity core + vault Implemented 2026-07-10 — Wave 1: OTP auth, JWT sessions, native clients. **Vault model revised 2026-08-16 — E2EE retired, classification data moves server-side (ADR-001); VLT-01..06 and IDT-05 restated, migration not yet implemented.** Pending: the ADR-001 migration (schema → API → clients), refresh rotation/reuse detection (IDT-02), account deletion (IDT-04), contact discovery (IDT-06), invite links + web landing (IDT-07/09)) · **Agents:** Backend (lead), iOS + Android (vault client), Data Steward (models), Web (invite landing) · **Depends on:** nothing — everything depends on it. · **Blueprint:** implied by Onboarding + the privacy promise.

## Purpose

The trust foundation: who you are (phone-OTP identity), who you're connected to (edges only), and where your private data lives — **server-side in Postgres, with the device holding a cache** (ADR-001, 2026-08-16; previously an on-device encrypted vault). This spec is where product law 4 becomes engineering: privacy *from other users*, enforced by access control and the mutual-reveal rule, not by the operator being unable to read the data.

## Functional requirements — Identity (⚠️ ASSUMPTION: phone-OTP, product-overview §6)

| ID | Requirement |
|---|---|
| IDT-01 | Signup/login via phone number + SMS OTP. Server stores `phoneHash` (client-side salted hash of E.164) — never the raw number. |
| IDT-02 | Sessions: short-lived JWT access token + rotating refresh token per device. Refresh reuse detection revokes the family. |
| IDT-03 | OTP endpoints throttled per phoneHash and per IP (backend agent rate-limit rules); codes single-use, ≤5 min validity. |
| IDT-04 | Account deletion (in-app) triggers full cascade erasure (Data Steward rule 2) and is irreversible after a 7-day grace ⚠️ ASSUMPTION. |
| IDT-05 | Multi-device: each device registers (`Device` model) with its own push token. Since the server holds the classification data (ADR-001), any authenticated device syncs the same state — there is no key transfer and no backup phrase. *(Supersedes the re-import-via-phrase assumption.)* |

## Functional requirements — Contact graph

| ID | Requirement |
|---|---|
| IDT-06 | Contact discovery: client hashes imported numbers locally and submits batches; server returns which hashes correspond to existing users. Response shape/time must not reveal non-member info beyond the boolean (backend agent rule 5). |
| IDT-07 | Non-member contacts can be linked (`ContactLink.targetId = null`, `invitedPhoneHash` set) and invited via share-sheet link to the web landing (Web agent scope). When the invitee joins, pending links resolve automatically. |
| IDT-08 | Links are directional and private: B never learns they're in A's circle until a match reveals a specific shared envie. No "X added you" notifications, ever. |
| IDT-09 | Invite links carry opaque single-purpose tokens (web agent rule 3); the landing page shows the inviter's `displayName` only after token validation, and nothing about the circle. |

## Functional requirements — Vault

| ID | Requirement |
|---|---|
> **Revised 2026-08-16 — see `docs/decisions/ADR-001-server-side-classification-data.md`.** End-to-end
> encryption and the opaque vault blob are retired; the database is the single source of truth. The
> requirement IDs below are kept stable (they are referenced by tests and the E2E manifest) but their
> content is superseded as noted.

| ID | Requirement |
|---|---|
| VLT-01 | Classification content — the four axes, filter rules, **user-authored** subgroup state (names, pins, hidden flags) and relation history — is stored **server-side in Postgres as typed, queryable columns**, owned by the Data Steward. Encrypted in transit (TLS) and at rest (managed disk/KMS). No client-side encryption of this data. The subgroup **lattice itself is derived, not stored**: it is recomputed on-device from cached tags (SGR-01, OQ-SGR-2). *(Supersedes the AES-256-GCM on-device vault.)* |
| VLT-02 | Server API exposes **typed resource endpoints** for classification data, not opaque storage. Writes are authenticated and authorised per-user; a user may only ever read or write their own classification data. *(Supersedes the `GET/POST /vault` blob + version contract.)* |
| VLT-03 | Server code MAY read, index and compute over classification data to serve the product (matching, filtering, subgroups). It MUST NOT log it, expose it to any other user, or include it in error payloads (G3). |
| VLT-04 | The device keeps a **local cache** for offline reads and queues writes for replay; the app stays fully usable for map/fiche/sous-groupes with zero connectivity. The cache is not authoritative — on conflict, the server wins. |
| VLT-05 | Device loss, theft or replacement no longer loses data. The user re-authenticates with their phone number (IDT-01) on any device and the server restores their full classification state. *(Supersedes the accepted "device loss = data loss" POC trade-off.)* |
| VLT-06 | In-app copy MUST NOT claim or imply end-to-end encryption, or that the service cannot see a user's classement. Copy asserting what is still true — no other user ever sees it, links are one-directional, refusal is indistinguishable from silence — is retained. |
| VLT-07 | Writes are **per-record and typed** (one mutation = one record), never a whole-state push. Every mutation carries a client-generated id and is **idempotent**: replaying it after a timeout or partial failure MUST NOT double-apply. |
| VLT-08 | `updatedAt` is **assigned by the server** (the API process clock) on every write; client clocks are never trusted for ordering or conflict resolution. Clients sync via an **opaque cursor** encoding `updatedAt` (+ a row id for same-millisecond paging) and receive only changed records, never the full dataset. The cursor is inclusive of its own millisecond and MAY re-deliver a record the client already has — clients overwrite their cache with the server response regardless, so a re-send is idempotent where a skip would risk silent data loss. |
| VLT-09 | **Revised 2026-08-26 (#132) — was wall-clock LWW; corrected to match the shipped implementation, which is compare-and-swap.** There is no incoming client timestamp to race against a "later" wall-clock write (VLT-08 forbids trusting client clocks for ordering at all), so "last-write-wins by `updatedAt`" had no second operand to compare. What both platforms MUST implement instead: conflict resolution is **field-level compare-and-swap (CAS) against the client's last-observed base timestamp**. Every field write in a `PATCH` request has the wire shape `{ value, baseUpdatedAt }`, where `baseUpdatedAt` is the per-field `updatedAt` the client last received from the server for that exact field (`null` means "I have never seen a server value for this field"). The server applies the write **iff** the field's stored timestamp equals the write's `baseUpdatedAt` (both `null` counts as equal); the check and the write happen as one atomic statement. If they differ, the write is rejected: the **stored server value wins**, nothing is overwritten, and the field's name is returned in the response's `staleFields` array so the client knows precisely which field lost and can re-read the current value before deciding what to do next (see stale-edit UX below). Deletions are **tombstoned**, so a stale device replaying an old update cannot resurrect deleted data. Both platforms MUST implement this identically. |
| VLT-10 | Offline writes queue in a **durable local outbox** and replay **in order** on reconnect. The app stays fully usable offline; the cache is never authoritative — on any disagreement the server's value wins. |

## Acceptance criteria (key)

- **Given** a full user lifecycle (signup → calibrate → envie → match → delete account), **when** erasure completes, **then** zero rows reference the user (deletion-cascade test, DAT rule 2) and their phoneHash can re-register as a fresh account.
- **Given** user A's classification data in the database, **when** user B calls any endpoint by any route, **then** no response ever reveals A's rings, tags, rules, subgroups or scope names, and B cannot learn they appear in A's circle (IDT-08). This is auditable and MUST be re-verified whenever the schema or API changes.
- **Given** a user signs in on a brand-new device with only their phone number, **when** the initial sync completes, **then** their full classification state is restored (VLT-05).
- **Given** the same user on two devices, **when** device A changes a contact's ring and device B changes the same contact's ressenti while both are online, **then** after both sync each device shows *both* changes — neither field is lost (VLT-09 field-level CAS, not record-level).
- **Given** a device offline with queued mutations, **when** connectivity returns and a replay request times out and is retried, **then** the mutation is applied exactly once (VLT-07 idempotency).
- **Given** a contact deleted on device A, **when** device B replays a stale pre-deletion update for that contact, **then** the contact stays deleted (VLT-09 tombstones).
- **Given** device A (offline since 00:00) edits a contact's ring at 00:30 and syncs, **when** device B — never having seen A's edit — edits the same ring at 01:00 against its stale `baseUpdatedAt` and reconnects at 03:00, **then** A's edit wins (the CAS check fails for B), the ring keeps A's value, and B's response names `ring` in `staleFields` rather than silently discarding or silently overwriting B's intent (VLT-09 CAS, product law 2 — *rien ne disparaît en silence*).
- **Given** any log output at any level across a full user lifecycle, **when** it is inspected, **then** it contains no classification values, envie verbs, recipient lists, phone hashes or push tokens — IDs and counts only (VLT-03/G3).

## Stale-edit UX (client-side, VLT-09)

**Revised 2026-08-26 (#132).** The API tells a client exactly which fields of a write were rejected (`staleFields`), but FS-07 never said what the client does with that — and Stage 4 (the sync clients) cannot be built without an answer. The mechanism below is a ⚠️ ASSUMPTION buildable default, not frozen copy; the exact interaction and its French wording are `OQ-VLT-3` below and need founder/design sign-off before Stage 4 ships, per the no-dark-patterns, nothing-hidden-silently product ethos this repo holds everywhere else.

- ⚠️ ASSUMPTION: on receiving a field in `staleFields`, the client MUST NOT silently drop the user's rejected edit, and MUST NOT silently leave the user believing their edit applied. The screen showing that field re-renders with the current server value (already present in the same response's `contact`), so the user sees what actually won.
- ⚠️ ASSUMPTION: the user's rejected input is not discarded outright — it stays available for them to knowingly re-apply (a normal edit against the now-current `baseUpdatedAt`, not an automatic retry the client fires on its own). No automatic silent retry, no automatic silent overwrite either direction.
- ⚠️ ASSUMPTION: this is surfaced inline on the field itself (e.g. a brief state change on the ring/état/ressenti control the user just touched), not a blocking modal, a counter, or anything resembling a notification badge — consistent with "no counters, celebrations, or urgency anywhere" (`CLAUDE.md`).
- Out of scope for this note: the exact visual treatment and French microcopy. That is FS-01/FS-03 territory and is tracked as `OQ-VLT-3`.

## Open questions

OQ-IDT-1: SMS provider choice + cost ceiling for OTP on free-tier POC (Twilio trial vs alternatives) — DevOps/Hamza.
~~OQ-IDT-2~~: **RESOLVED 2026-08-16** — neither. Classification data moved server-side, so recovery is ordinary re-authentication and no recovery phrase is needed (ADR-001). VLT-05 rewritten accordingly.
OQ-VLT-3: Stale-edit UX (#132) — the mechanism above (surface the winning value inline, keep the user's rejected edit available to knowingly re-apply, no auto-retry/auto-overwrite) is a buildable default. Needs founder/design sign-off on the actual visual treatment and normative French copy before Stage 4 (FS-01/FS-03, iOS + Android) implements it.
