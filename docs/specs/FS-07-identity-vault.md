# FS-07 — Identity, Contacts & Vault Sync (foundation)

**Status:** In progress (identity core + vault Implemented 2026-07-10 — Wave 1: OTP auth, JWT sessions, native clients. **Vault model revised 2026-08-16 — E2EE retired, classification data moves server-side (ADR-001); VLT-01..06 and IDT-05 restated, migration not yet implemented.** Pending: the ADR-001 migration (schema → API → clients), refresh rotation/reuse detection (IDT-02), account deletion (IDT-04), contact discovery (IDT-06), invite links + web landing (IDT-07/09)) · **Agents:** Backend (lead), iOS + Android (vault client), Data Steward (models), Web (invite landing) · **Depends on:** nothing — everything depends on it. · **Blueprint:** implied by Onboarding + the privacy promise.

## Purpose

The trust foundation: who you are (phone-OTP identity), who you're connected to (edges only), and where your private data lives (the encrypted vault). This spec is where product law 4 becomes engineering.

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
| VLT-01 | Classification content (four axes, filter rules, subgroup lattice+names+pins, relation history) is stored **server-side in Postgres as typed, queryable columns**, owned by the Data Steward. Encrypted in transit (TLS) and at rest (managed disk/KMS). No client-side encryption of this data. *(Supersedes the AES-256-GCM on-device vault.)* |
| VLT-02 | Server API exposes **typed resource endpoints** for classification data, not opaque storage. Writes are authenticated and authorised per-user; a user may only ever read or write their own classification data. *(Supersedes the `GET/POST /vault` blob + version contract.)* |
| VLT-03 | Server code MAY read, index and compute over classification data to serve the product (matching, filtering, subgroups). It MUST NOT log it, expose it to any other user, or include it in error payloads (G3). |
| VLT-04 | The device keeps a **local cache** for offline reads and queues writes for replay; the app stays fully usable for map/fiche/sous-groupes with zero connectivity. The cache is not authoritative — on conflict, the server wins. |
| VLT-05 | Device loss, theft or replacement no longer loses data. The user re-authenticates with their phone number (IDT-01) on any device and the server restores their full classification state. *(Supersedes the accepted "device loss = data loss" POC trade-off.)* |
| VLT-06 | In-app copy MUST NOT claim or imply end-to-end encryption, or that the service cannot see a user's classement. Copy asserting what is still true — no other user ever sees it, links are one-directional, refusal is indistinguishable from silence — is retained. |

## Acceptance criteria (key)

- **Given** a full user lifecycle (signup → calibrate → envie → match → delete account), **when** erasure completes, **then** zero rows reference the user (deletion-cascade test, DAT rule 2) and their phoneHash can re-register as a fresh account.
- **Given** user A's classification data in the database, **when** user B calls any endpoint by any route, **then** no response ever reveals A's rings, tags, rules, subgroups or scope names, and B cannot learn they appear in A's circle (IDT-08). This is auditable and MUST be re-verified whenever the schema or API changes.
- **Given** a user signs in on a brand-new device with only their phone number, **when** the initial sync completes, **then** their full classification state is restored (VLT-05).
- **Given** any log output at any level across a full user lifecycle, **when** it is inspected, **then** it contains no classification values, envie verbs, recipient lists, phone hashes or push tokens — IDs and counts only (VLT-03/G3).

## Open questions

OQ-IDT-1: SMS provider choice + cost ceiling for OTP on free-tier POC (Twilio trial vs alternatives) — DevOps/Hamza.
~~OQ-IDT-2~~: **RESOLVED 2026-08-16** — neither. Classification data moved server-side, so recovery is ordinary re-authentication and no recovery phrase is needed (ADR-001). VLT-05 rewritten accordingly.
