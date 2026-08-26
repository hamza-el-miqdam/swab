# ADR-001 — Classification data moves server-side; the database becomes the single source of truth

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decider:** Hamza (founder/product owner)
- **Supersedes:** the end-to-end-encryption half of the G1 privacy invariant (`agents/_global-directives.md`), FS-07 `VLT-01`/`VLT-03`/`VLT-05`, `IDT-05`
- **Resolves:** FS-07 `OQ-IDT-2` (recovery-phrase UX vs. accepting device-loss = data-loss)

## Context

Until now, relationship classification data — intimité rings, rôles, état, ressenti, filter rules,
subgroup names, relation history — was encrypted on-device (AES-256-GCM, key in iOS Keychain /
Android Keystore) and stored server-side only as an opaque `Vault` blob. `VLT-03` forbade the server
from decoding it. `VLT-05` explicitly accepted "lose the device without the recovery phrase, lose the
data" as a POC trade-off, and `OQ-IDT-2` parked the question of whether to build a recovery phrase.

Two problems drove revisiting it:

1. **Device loss is data loss.** The vault key is generated on-device and never leaves it
   (`VaultKeyStore.swift`, `AndroidKeystoreVaultKeyStore.kt`). A stolen, broken, or replaced phone
   means the user's entire relationship map is unrecoverable. No recovery mechanism was ever built.
2. **Dual-state complexity.** Keeping authoritative state both on-device and in Postgres, encrypted,
   with `version`-based optimistic concurrency and client-side merge, is expensive to build and
   reason about for a solo founder.

## Decision

**Option D**, chosen after a second review on 2026-08-16. Four commitments, and all four are part of
the decision — the first alone does not deliver what was asked for:

1. **Classification data is stored server-side in Postgres as ordinary queryable columns.** The database
   is the single source of truth; the device holds a cache, not the original. E2EE and the opaque
   `Vault` blob are retired.
2. **The sync model is fixed at the same time** — per-record writes, server-assigned timestamps, an
   offline outbox, and delta pulls. See "Sync model" below. This, not the storage change, is what
   actually solves multi-device consistency.
3. **`Envie.verb` is shaped so it can become ciphertext later** without restructuring the schema or the
   API. See "Forward compatibility" below.
4. **In-app copy stops claiming end-to-end encryption** (VLT-06), and says plainly what is still true.

Users recover their data by authenticating with their identity (phone number → OTP, `IDT-01`); a new or
replacement device re-downloads everything from the server.

Data remains encrypted **in transit** (TLS) and **at rest** (managed disk/KMS), and access is
least-privilege — but the operator (us) can technically read it. That is the substance of the change.

## Alternatives considered

The first review (option A vs B vs hybrid) initially recommended keeping E2EE and adding key recovery,
on the grounds that the vault key is already a portable raw 32-byte AES key deliberately kept
re-wrappable — so recovery is "wrap the key a second way", not a rewrite. That recommendation was
**withdrawn on evidence** in the second review: it addressed device loss but not multi-device
consistency, and it under-costed the client work for this specific codebase.

| Option | Verdict |
|---|---|
| **A — full plaintext server-side.** | Effectively chosen, but insufficient on its own: it does not by itself fix multi-device consistency (see "the blob is the real culprit" below). Adopted as part of D. |
| **B — plaintext except `Envie.verb`**, encrypted to matched parties and revealed client-side on mutual match. Attractive because the verb is the single most damaging field (free-text desire naming a friend), is append-only, and expires in 48h (`ENV-07`) — so it needs no CRDT. Viable only if matching runs on `category` + reciprocal recipients rather than verb text, which `product-overview` §6.3 already assumes. | **Deferred, not rejected.** Kept reachable by commitment 3 rather than built now. |
| **C — full E2EE + key escrow + CRDT.** Re-costed with research on 2026-08-16 and rejected on evidence: the local-first E2EE ecosystem that makes multi-device sync tractable is essentially TypeScript/web-only. Jazz/CoJSON is React-first (React Native is a separate, limited package), Evolu is TS, Zero is TS + Drizzle. Automerge 3.0 has a Rust core that can be FFI'd into Swift/Kotlin, but its **encrypted** sync protocol is not production-ready. Apple's CloudKit CRDT support is Apple-only, so useless for Android. Making a short recovery PIN safe additionally needs Signal-SVR-style HSM/enclave attempt-limiting. | Rejected: for a **native Swift + Kotlin** app there is no batteries-included option, so this means building encrypted CRDT sync twice, by hand, as a solo founder. |
| **Status quo** (device-bound key, device loss = data loss, per old `VLT-05`). | Rejected: unacceptable product behaviour beyond POC. |

### The blob is the real culprit

Worth recording, because it is the most easily-missed point: **multi-device inconsistency was caused by
the single opaque blob with last-write-wins, not by encryption.** Dropping E2EE while keeping a
"download whole state → edit → upload whole state" sync would still lose updates across two devices.
Conversely, E2EE with a per-record operation log converges correctly. Storage format and sync
granularity are independent choices; only the second one fixes consistency.

## Sync model (commitment 2)

The problem this solves: a user with two devices edits on one and expects to see it on the other, without
either device silently clobbering the other's work. Whole-state sync cannot provide that.

**The data is the easy case.** A user's classification has exactly **one writer** — them, across their own
devices. There is no cross-user editing of the same record, so full CRDTs are not required:
**last-write-wins per field, using server-assigned timestamps**, is sufficient and correct here.

Rules:

1. **Per-record writes.** Every mutation is a typed API call against one record (`PATCH /contacts/{id}`
   style), never a whole-state push. The `GET/POST /vault` blob contract is retired.
2. **The server owns time.** `updatedAt` is assigned server-side on every write. Client clocks are never
   trusted for conflict resolution — phones have skewed and user-settable clocks.
3. **Offline outbox.** Client mutations while offline append to a durable local queue and replay in order
   on reconnect. Replay must be **idempotent** — each mutation carries a client-generated id so a retry
   after a half-failed request cannot double-apply.
4. **Delta pulls.** Clients sync with a cursor (`?since=<server timestamp or opaque cursor>`) and receive
   only what changed, never the full dataset. Required for the two-device case to be cheap enough to run
   often.
5. **Conflict rule, stated once so both platforms implement it identically:** field-level LWW by server
   `updatedAt`; on a tie, the server's stored value wins. Deletions are tombstoned, not hard-deleted, so a
   delete cannot be resurrected by a stale device replaying an old update.

The cache is never authoritative. On any disagreement, the server's value is correct.

## Forward compatibility — keeping option B reachable (commitment 3)

So that encrypting the most sensitive field later does not require a schema or API rewrite:

- `Envie.verb` is modelled as an **opaque-to-the-schema payload column** (a `String`/`Bytes` treated as a
  unit), never split, normalised, indexed, or full-text-searched. It is already forbidden from indexes by
  the data-steward rules; that constraint now has a second reason and must not be relaxed.
- **Matching MUST NOT depend on verb text.** Compatibility is computed from normalised `category`
  equality plus reciprocal recipients (`product-overview` §6.3). Any future proposal to match on verb
  semantics forecloses option B and needs its own ADR.
- No server-side feature (search, analytics, moderation, notification previews) may read `verb`. Treat it
  as write-only from the server's perspective, even though it is technically readable.

## Consequences

### Enabling

- Device change, loss, and theft are ordinary re-login flows. `VLT-05`'s data-loss trade-off disappears.
- Matching (`FS-05`), filtering rules (`FS-06`), and subgroups (`FS-04`) can be computed server-side
  instead of on-device — a substantial simplification of the three unbuilt specs.
  > **Correction, 2026-08-26 (#115):** retracted. This over-generalised from *filter rules*, which are
  > server-stored, to *matching resolution* and *subgroup membership*, which are not. The server never
  > persists the subgroup lattice — it is derived on-device from cached tags and never stored (`SGR-07`,
  > `OQ-SGR-2`) — so it cannot resolve a portée on its own, and the same reasoning extends to match/filter
  > resolution. All three specs have since settled on-device: `FS-04` `OQ-SGR-2` (resolved 2026-08-16, FCA
  > stays on-device), `FS-05` `ENV-05` (corrected 2026-08-16, resolution runs on-device), `FS-06` `OQ-FLT-2`
  > (resolved 2026-08-22, evaluation stays on-device). Read those three as the current rule, not this bullet
  > — kept here verbatim as a record of what was believed at decision time, per this ADR's own transitional-
  > state convention.
- Multi-device becomes near-free; `IDT-05`'s "new device = re-import via backup phrase" assumption is void.
- A web client (`apps/web`) becomes possible.
- User-reported problems become debuggable.
- Track C of the `suggestions/` backlog shrinks: the vault-shape divergence, decrypt-failure, key-race
  and sync-conflict items are moot by construction (see "Backlog impact").

### Costs accepted

These were raised before the decision and are recorded here so they are not rediscovered as surprises:

- **We can read users' private opinions of their friends.** Ressenti/état/rôles describe what a user
  thinks about someone *behind their back*. A breach, a subpoena, or a curious employee now exposes it.
  This is a heavier class of data than message content.
- **The trust proposition changes.** The "revealed only if mutual" mechanic previously rested on the
  server being unable to peek. It now rests on our promise and our access controls. This must be stated
  honestly in-app — the product ethos forbids implying an E2EE guarantee we no longer provide.
- **Regulatory weight increases.** Envies plausibly make this special-category data under GDPR. A DPIA,
  a documented retention policy, and breach-notification readiness become obligations, not nice-to-haves.
- **Partial one-way door.** Migrating the data back to E2EE later is feasible, but any server-side
  matching/filtering built in the meantime would have to be moved back on-device. That rework — not the
  data migration — is the expensive part of reversing this.

### Newly critical (priority changes, not new work)

With no client-side encryption layer, the session token is the only thing between an attacker and a
user's complete classification data. Two backlog items are upgraded from "medium" to "high":

- `SUG-AND-006` — `KeystoreTokenStore` writes both JWTs as **plaintext** into DataStore despite its name.
- `SUG-API-002` — refresh-token rotation and reuse detection (`IDT-02`) are still unimplemented.

Neither should ship after the server-side migration; ideally both land before it.

### Unchanged

The privacy guarantees *between users* are untouched, because they never depended on encryption:

- `IDT-08` — links stay directional and private; B never learns they are in A's circle.
- No "X added you" notifications, ever.
- `G3` logging rules — classification data, envie verbs, recipient lists, phone hashes and push tokens
  stay out of logs regardless of where they are stored.
- `IDT-01` — phone numbers are still stored only as client-side salted hashes.

## Backlog impact

Effect on the 40 open items in `suggestions/` (re-triage is stage 5; nothing is closed yet).

**Moot by construction — the failure mode ceases to exist:**

| Item | Why |
|---|---|
| `SUG-IOS-001` | Cross-platform vault blob shape divergence — there is no blob. This was the single biggest blocker in the backlog. |
| `SUG-IOS-004` / `SUG-AND-004` | "Undecryptable vault" UX — nothing to decrypt. (AND-004 already shipped; its handling becomes dead code.) |
| `SUG-IOS-018` | VaultSync conflict-path gaps — the version/409 merge protocol is retired. |
| `SUG-AND-010` | Vault key creation race — no vault key. |
| `SUG-IOS-009` | `FileKeyValueStore` durability/protection for vault data — cache only, re-fetchable. |

**Changed in meaning, not deleted:** `SUG-IOS-002` / `SUG-AND-001` (sync triggers → cache refresh + write replay),
`SUG-IOS-007` / `SUG-AND-013` (history quota → server-side retention).

**Unaffected and now higher priority:** `SUG-AND-006`, `SUG-API-002` (see "Newly critical" above).

**Becomes more important:** `SUG-IOS-011` (classification values coupled to French display copy). Once these
values are database columns, a label change is a data migration — decoupling stored value from displayed copy
must happen *before* the schema is written, not after. It was previously gated on `SUG-IOS-001`; it is now
scheduled as stage **0b** — a hard prerequisite for the schema work in stage 2.

## Follow-up work

Tracked in dependency order; each stage is its own PR series. Stages 0a/0b are prerequisites that were
**not** in the first version of this plan — they were added when option D was chosen.

| # | Stage | Area | Why here |
|---|---|---|---|
| 0a | **Full spec review against this ADR** | `area:specs` | FS-02/03/04/06 were written assuming on-device classification and have not been re-read. Must complete before schema design freezes. Tracked as its own issue. |
| 0b | **Decouple stored values from French display copy** (`SUG-IOS-011`) | `area:specs`, `area:ios`, `area:android` | Once values are DB columns a label change becomes a data migration. Must land **before** stage 2, not after. Was previously blocked on `SUG-IOS-001`, which this ADR moots. **Contract frozen 2026-08-16** in FS-03 `FCH-09` + *Stored value vocabulary* — stage 2 takes its enum values from that table, not from either client. |
| 0c | **Session-token hardening** (`SUG-AND-006`, `SUG-API-002`) | `area:android`, `area:backend` | With no client-side encryption the session token is the only thing guarding the full dataset. Should land before the data moves. |
| 1 | **Governance + specs** (this PR) | cross-cutting | G1, `CLAUDE.md`, constitution, FS-07, vision docs. |
| 2 | **Schema** | `area:db` | Model classification server-side: relations, four axes, filter rules, subgroups, history. Include `updatedAt` per stateful row and tombstones (sync model rules 2 and 5). Retire or repurpose `Vault`. Honour the `Envie.verb` constraints above. |
| 3 | **API** | `area:backend` | Per-record typed endpoints, delta pulls with a sync cursor, idempotent writes keyed by client mutation id, server-assigned `updatedAt`. Server-side matching on `category` only — never on verb text. |
| 4 | **Clients** | `area:ios`, `area:android` | Drop `VaultCrypto`; local cache + durable offline outbox with in-order idempotent replay; field-level LWW per rule 5. Update `ApiClientPrivacyInvariantTests` + `ONB-05` + `docs/qa/e2e-coverage.json` together. |
| 5 | **Backlog re-triage** (`suggestions/`) | — | Close the moot Track C items, re-file the ones that changed meaning. |
| 6 | **French copy replacement** | `area:design` + founder | See below — needs a product decision. |

**Sequencing note:** stages 0b and 0c are cheap and independent; run them in parallel with 0a. Stage 2
must not start until 0a and 0b are done, because both change the shape of what gets modelled.
6. **Honesty pass — French copy needs a product decision, not a mechanical edit.** The following user-facing
   strings are now false and are deliberately left in place pending replacement copy from the founder/design
   (French UI copy is normative and ported verbatim from specs — it is not for an implementer to invent):
   - FS-01 `ONB-01` / `ONB-07` and `docs/qa/e2e-scenarios.md`: « Personne — ni eux, ni nous — ne voit comment tu l'as remplie. »
   - FS-01 user story: « Tout reste chiffré sur ton téléphone »
   - `docs/design/swab-prototype-consolidated.html`: « Elle ne voit jamais votre classement — ni les rôles, ni l'intimité, ni la présence. »
   Replacement copy must satisfy VLT-06: it may promise that no *other user* sees the classement, never that we cannot.

## Transitional state

This ADR changes the rules and the specs; **no code has changed yet**. Until the migration lands:

- The apps still encrypt, and `apps/ios/Tests/SwabCoreTests/ApiClientPrivacyInvariantTests.swift`
  (`test_ONB05_*`) still asserts that no classification data appears in any request. Those tests are correct
  about current behaviour and must stay green — do not pre-emptively delete them.
- FS-01 `ONB-05` is marked transitional and states both the current and the post-migration requirement.
- The migration PR updates `ONB-05`, `docs/qa/e2e-coverage.json`, and those tests together.
