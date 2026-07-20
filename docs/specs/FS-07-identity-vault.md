# FS-07 — Identity, Contacts & Vault Sync (foundation)

**Status:** In progress (identity core + vault Implemented 2026-07-10 — Wave 1: OTP auth, JWT sessions, opaque vault store, native vault clients. Pending: refresh rotation/reuse detection (IDT-02), account deletion (IDT-04), contact discovery (IDT-06), invite links + web landing (IDT-07/09). Multi-device/recovery-phrase remain POC assumptions, see IDT-05/VLT-05) · **Agents:** Backend (lead), Mobile (vault client), Data Steward (models), Web (invite landing) · **Depends on:** nothing — everything depends on it. · **Blueprint:** implied by Onboarding + the privacy promise.

## Purpose

The trust foundation: who you are (phone-OTP identity), who you're connected to (edges only), and where your private data lives (the encrypted vault). This spec is where product law 4 becomes engineering.

## Functional requirements — Identity (⚠️ ASSUMPTION: phone-OTP, product-overview §6)

| ID | Requirement |
|---|---|
| IDT-01 | Signup/login via phone number + SMS OTP. Server stores `phoneHash` (client-side salted hash of E.164) — never the raw number. |
| IDT-02 | Sessions: short-lived JWT access token + rotating refresh token per device. Refresh reuse detection revokes the family. |
| IDT-03 | OTP endpoints throttled per phoneHash and per IP (backend agent rate-limit rules); codes single-use, ≤5 min validity. |
| IDT-04 | Account deletion (in-app) triggers full cascade erasure (Data Steward rule 2) and is irreversible after a 7-day grace ⚠️ ASSUMPTION. |
| IDT-05 | Multi-device: each device registers (`Device` model) with its own push token; vault key transfer between devices is out of scope for POC — new device = re-import vault via key backup phrase ⚠️ ASSUMPTION (simplest honest option). |

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
| VLT-01 | Vault content (four axes, filter rules, subgroup lattice+names+pins, relation history) is encrypted on-device (AES-256-GCM; key in `expo-secure-store`, derived key backed up via a user-held recovery phrase ⚠️ ASSUMPTION). |
| VLT-02 | Server API is dumb storage: `GET/POST /vault` moves one opaque `Bytes` blob + integer `version`. Optimistic concurrency: POST with stale version → 409; client re-pulls, merges locally, retries. Single-device POC ⇒ last-write-wins is acceptable. |
| VLT-03 | Server code MUST NOT decode, log, index, or size-analyze blob contents beyond byte length for quota (≤1 MB per user ⚠️ free-tier budget). |
| VLT-04 | Sync triggers: app background, post-onboarding, after any vault write burst (debounced ≥30s). Full offline operation between syncs. |
| VLT-05 | Losing the device without the recovery phrase loses the classification data — accepted POC trade-off, stated honestly in-app (product ethos: no false promises). |

## Acceptance criteria (key)

- **Given** a full user lifecycle (signup → calibrate → envie → match → delete account), **when** erasure completes, **then** zero rows reference the user (deletion-cascade test, DAT rule 2) and their phoneHash can re-register as a fresh account.
- **Given** the server database contents in full, **when** an attacker (or we) inspects them, **then** nothing reveals any user's rings, tags, rules, subgroups, or scope names — only edges, envies (verb/category/recipients), matches, proposals. This is auditable and MUST be re-verified whenever the schema changes.
- **Given** two rapid vault writes from one device, **when** both sync, **then** the final blob reflects the later state and no 409 loop occurs.

## Open questions

OQ-IDT-1: SMS provider choice + cost ceiling for OTP on free-tier POC (Twilio trial vs alternatives) — DevOps/Hamza.
OQ-IDT-2: confirm recovery-phrase UX vs. accepting device-loss = data-loss for POC (VLT-05).
