# SUG-SPEC-017 — Phase 0c.3: amend FS-04 (manual groups; FCA becomes a suggestion)

- **Area:** specs
- **Topic:** targeted amendment — **not** a rewrite
- **Impact:** medium — smaller than it looks; most of FS-04 survives verbatim
- **Effort:** S/M
- **Implementing agent:** spec-specialist
- **Depends on:** [SUG-SPEC-014](SUG-SPEC-014-adr002-amend-binding-directives.md); best done **after**
  [SUG-SPEC-016](SUG-SPEC-016-adr002-fs05-rewrite.md) so the group's role is already pinned down
- **Related:** [ADR-002](../../docs/decisions/ADR-002-envie-becomes-a-proposition.md), [FS-04](../../docs/specs/FS-04-subgroups.md)

## Problem

The first ADR-002 draft implied FS-04 needed rewriting. **The 2026-08-27 revision made that false**,
and `docs/STATUS.md:20` now records the correct disposition: *amended, not rewritten*. Groups stay
**private to their owner**, so FS-04's privacy requirements survive verbatim — `SGR-07` (names and
structure never disclosed to another user) and `SGR-08` (« aucun comptage ») were already exactly
what ADR-002 commitments 3 and 4 require.

Two things genuinely change:

1. **« Tu ne définis jamais un groupe à la main » is void.** Manual creation is now the primary path;
   FCA is demoted to an opt-in suggestion.
2. **Persistence splits in two**, and this is the subtle part. `OQ-SGR-2` (RESOLVED 2026-08-16) says
   the FCA lattice is derived on-device and **never persisted**. ADR-002's schema section says
   `Group` / `GroupMember` are **server rows, owner-scoped**. Both are true after the amendment, of
   different objects — and if that is not written down explicitly, the next implementer will read one
   of them and contradict the other.

The determinism apparatus — `SGR-09a` (ordering), `SGR-09b` (NFC + code-point string comparison),
`SGR-09c` (integer-only arithmetic), the normative Ana/Ben/Chloé/Dan worked example, and its
cross-platform parity gate via `docs/specs/vectors/fca-test-vectors.json` — is **entirely unaffected**
and must survive character-for-character. It governs how FCA computes, and FCA still computes; it just
computes a suggestion now.

## Implementation plan

1. **Purpose / intro** — reframe: a group is a named set of people **you** assemble, private to you.
   FCA offers candidates; you decide. Delete « tu ne définis jamais un groupe à la main ».

2. **`SGR-01`** — FCA no longer *produces* the user's groups; it produces **suggested** groups the
   user may accept, rename, edit, or ignore. The algorithm itself is unchanged — do not touch the
   computation, only its status in the flow.

3. **Add manual CRUD requirements.** New IDs continuing FS-04's sequence (`SGR-10`+ — do **not**
   renumber existing ones). Cover: create a group, name it, add/remove members, rename, delete. Each
   must state the owner-privacy invariant explicitly:

   > Creating a group, naming it, adding someone to it, removing someone, or deleting it is invisible
   > to everyone but the owner. No notification, no membership list, no trace. Nobody ever learns they
   > are in a group — they learn only that a proposition arrived.

   This is ADR-002 commitment 3 and G1(a)'s « X t'a ajouté » prohibition, which the pivot **preserves**.

4. **Write the persistence split explicitly** (the step most likely to be skipped):
   - **Manually created groups are persisted server-side**, owner-scoped. Owner-scoping is an
     **authorization rule in the query**, not a client-side filter — no endpoint may return a group,
     its name, or its membership to anyone but its owner.
   - **FCA-derived suggestions stay on-device and are never persisted** (`SGR-07`, `OQ-SGR-2` — still
     resolved, still binding). A suggestion becomes a server row only when the user accepts it, and
     what is stored then is an ordinary manual group, carrying no marker that FCA proposed it.
   - Add a note under `OQ-SGR-2` recording that ADR-002 did **not** reopen it.

5. **`SGR-07`, `SGR-08`** — do not touch. Add a one-line note that ADR-002 re-confirmed both. They are
   now cited by FS-05's recipient-facing copy rules, so a future editor needs to know they are
   load-bearing beyond FS-04.

6. **`SGR-09a/b/c`, the worked example, the parity vectors** — do not touch. If the amendment makes
   any of them look editable, stop: it doesn't.

7. **Check the FS-05 dependency line.** FS-04's header lists dependants; FS-05's `Depends on: FS-04,
   FS-06, FS-07` line will change when SUG-SPEC-016 and SUG-SPEC-018 land. Keep the two files
   consistent in whichever order they merge.

8. **`docs/STATUS.md`** — the FS-04 row already carries the correct ADR-002 note; update only the
   status/notes if the amendment changes what is next. Root `CHANGELOG.md` entry (G5).

9. Open an **`area:db`** issue (or fold into SUG-SPEC-016 step 5's issue if it is still open) for
   `Group` / `GroupMember` as owner-scoped models. Do not edit `schema.prisma` — one writer, G4.

## Tests & acceptance criteria

- `grep -n "jamais un groupe à la main" docs/specs/FS-04-subgroups.md` returns nothing.
- `git diff docs/specs/FS-04-subgroups.md` shows **zero** changed characters in `SGR-07`, `SGR-08`,
  `SGR-09a`, `SGR-09b`, `SGR-09c`, and the worked example.
- `SGR-09`'s vector-file contract is unchanged. **Note:** `docs/specs/vectors/` does not exist yet —
  the file is specified but uncreated (FS-04 is ⚪ Not started; `SGR-09` says it must exist and be
  reviewed *before* either platform starts). Do not create it in this PR, and do not "fix" the
  dangling path — it is a forward reference, not a bug. Both `agents/ios-specialist.md:30` and
  `agents/android-specialist.md:29` cite the same path; leave them alone.
- Existing `SGR-01`..`SGR-09` IDs keep their numbers. New requirements start at `SGR-10`.
- The spec states, in one place a reader will find it, which group data is server-persisted and which
  is device-only.
- No requirement anywhere implies a member can see the group, its name, its size, or its other members.

## Risks

- **Over-correcting into a rewrite.** The instinct after reading ADR-002's first draft is to rebuild
  FS-04. That draft is void. Everything about privacy and determinism here was already right.
- **The persistence split going unwritten.** `OQ-SGR-2` and ADR-002's schema section can be read as
  contradicting each other. If step 4 is skipped, an implementer will either persist the FCA lattice
  (violating `SGR-07`) or refuse to persist manual groups (making them unusable across devices).
- **Renumbering.** `SGR-01`..`SGR-09` are cited in test names and issues. Append, never insert.
