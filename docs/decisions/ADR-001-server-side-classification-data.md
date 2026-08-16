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

**Classification data is stored server-side in Postgres as ordinary queryable columns. The database
is the single source of truth. The device holds a cache, not the original.**

Users recover their data by authenticating with their identity (phone number → OTP, per `IDT-01`);
a new or replacement device re-downloads everything from the server. The end-to-end encryption
requirement and the opaque `Vault` blob are retired.

Data remains encrypted **in transit** (TLS) and **at rest** (managed disk/KMS encryption), and access
is least-privilege — but the operator (us) can technically read it. That is the substance of the
change.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| **Keep E2EE, add key recovery** (platform keychain sync in phase 1 — iCloud Keychain / Google Block Store — then a user-held recovery code). This was the recommended option: the vault key is already a portable raw 32-byte AES key deliberately kept re-wrappable, so recovery is "wrap the key a second way", not a rewrite. | Rejected by the decider: retains the dual-state build cost, and the recovery-code UX is a real drop-off risk at onboarding. |
| **Hybrid — split by sensitivity** (low-sensitivity fields server-side, ressenti/état/envie verbs stay E2EE). | Rejected: most design work of the three, and the invariant becomes hard to enforce mechanically once it is per-field rather than per-blob. |
| **Status quo** (device-bound key, device loss = data loss, per `VLT-05`). | Rejected: unacceptable product behaviour beyond POC. |

## Consequences

### Enabling

- Device change, loss, and theft are ordinary re-login flows. `VLT-05`'s data-loss trade-off disappears.
- Matching (`FS-05`), filtering rules (`FS-06`), and subgroups (`FS-04`) can be computed server-side
  instead of on-device — a substantial simplification of the three unbuilt specs.
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
gated on stage 2 instead, and should be treated as a prerequisite for it.

## Follow-up work

Tracked in dependency order; each stage is its own PR series.

1. **Governance + specs** (this PR): G1, `CLAUDE.md`, the spec-kit constitution, FS-07, and dependent specs.
2. **Schema** (`area:db`, data-steward only): model classification server-side — relations, the four
   axes, filter rules, subgroups, history. Retire or repurpose the `Vault` model.
3. **API** (`area:backend`): replace the opaque `GET/POST /vault` with real resource endpoints; add
   server-side matching.
4. **Clients** (`area:ios`, `area:android`): drop `VaultCrypto`, consume the new endpoints, keep a local
   cache for offline reads.
5. **Backlog re-triage** (`suggestions/`): close the obsolete Track C items, re-prioritise the two above.
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
