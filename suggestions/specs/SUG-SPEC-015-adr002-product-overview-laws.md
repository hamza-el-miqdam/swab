# SUG-SPEC-015 — Phase 0c.1: rewrite product law 1, trim law 4, resync the glossary

- **Area:** specs
- **Topic:** product laws / vocabulary
- **Impact:** high — every spec, agent prompt and PR review cites these laws by number
- **Effort:** M (prose only, but the glossary terms are load-bearing across 7 specs)
- **Implementing agent:** spec-specialist
- **Depends on:** [SUG-SPEC-014](SUG-SPEC-014-adr002-amend-binding-directives.md) must land first
- **Related:** [ADR-002](../../docs/decisions/ADR-002-envie-becomes-a-proposition.md), [ROADMAP Phase 0c](../../docs/ROADMAP.md)

## Problem

`docs/product-overview.md:14-19` states five product laws. ADR-002 retires law 1 outright and deletes
**four words** from law 4. Laws 2, 3 and 5 survive **verbatim** — the 2026-08-27 ADR revision
explicitly re-verified law 5 (« calme par défaut ») against the vague-headcount decision and found it
untouched.

Beyond the laws, the same file carries the vocabulary that the other six specs import by reference:
`envie`, `portée`, `match`. Two of those three no longer describe the product. `README.md:15`
duplicates law 1 for the public-facing audience and drifts the moment this file changes.

## Implementation plan

1. **Law 1** — replace the mutual-reveal law. It is the only law that dies. Draft (founder-approved
   wording wins; this is a starting point, and it must stay a *law*, not a feature description):

   > **1. Une envie est adressée, jamais diffusée.** Tu proposes à des gens précis, et ils savent que
   > c'est toi. Personne ne reçoit une envie « de quelqu'un ».

   Do **not** replace it with a law about matching, scoring or suggestion — ADR-002 commitment 7
   ("Swab shows, doesn't decide") is a constraint on the *product*, and if it deserves a law that is a
   separate decision for the founder, not a drafting choice.

2. **Law 4** — delete exactly the four words « reveal is strictly mutual » (and the connective
   punctuation around them). The rest of law 4 — privacy *from other users* — is the load-bearing
   half and survives. Verify by diff that nothing else in the sentence moved.

3. **Laws 2, 3, 5** — do not touch. If a re-read makes one of them look newly wrong, that is a
   finding for the founder (open an OQ), not an edit.

4. **§1 (premise)** — the opening framing assumes a desire is withheld until reciprocated. Rewrite to
   the proposition model: a proposition is an invitation you send to people you chose, naming what,
   and answered by accept / counter-propose / silence.

5. **§3 (the receiver's role)** — currently describes the recipient as a passive half of a potential
   match. Rewrite around the three responses and the two-mode accept. **Copy requirement (binding):**
   the accept-without-revealing option must never be labelled with an unqualified « anonyme » /
   "anonymous" — the proposer always sees who accepted. The UI copy must say *to whom* the identity
   is hidden. This is ADR-002 commitment 5 and is the single most likely thing to be got wrong.

6. **§6 / category-based compatibility** — `docs/README.md:17` lists "category-based match
   compatibility" as a current global assumption pointing at §6. With no matching engine, decide
   whether categories survive as a *browsing/suggestion* affordance or die with the engine. If they
   survive, say what they are for now; if not, delete §6 and the `docs/README.md:17` bullet in the
   same pass. **This is a real decision — do not leave §6 standing unqualified.**

7. **Glossary** — three terms:
   - `envie` → redefine as a directed proposition. Keep the French word; it is the product's name for
     the thing and the founder has not retired it.
   - `portée` → no longer « toujours un sous-groupe, jamais un individu ». A proposition may be sent
     to a group *or* to individuals. Rewrite or retire the term; if retired, grep for `portée` across
     `docs/specs/` and leave a retirement note so the other specs' references resolve.
   - `match` → mark **retired**, with a pointer to ADR-002. Do not delete the entry; six specs and the
     schema still use the word, and a reader needs to be told it is dead rather than find nothing.

8. **`README.md:15`** — rewrite law 1 with the *same* wording chosen in step 1. Remove the `⚠️
   Superseded` marker that SUG-SPEC-014 step 7 added.

9. **`docs/README.md`** — update the "current global assumptions" list (line ~17) per step 6, and
   check the "Requirement IDs are law" traceability paragraph still reads true; the ENV-*→PRO-*
   renumbering it must survive is handled in [SUG-SPEC-016](SUG-SPEC-016-adr002-fs05-rewrite.md).

10. Update `docs/STATUS.md` if any module note becomes stale, and add the root `CHANGELOG.md` entry
    (G5) naming which laws changed and which were explicitly verified as unchanged.

## Tests & acceptance criteria

- `grep -rn "révélé\|revealed\|mutuel\|mutual" docs/product-overview.md README.md` returns only
  historical/retirement notes.
- The five laws are still numbered 1–5 and still five. **No renumbering** — every spec and agent
  prompt cites them by number.
- `grep -rn "anonyme\|anonymous" docs/product-overview.md` — every hit is qualified by whom the
  identity is hidden from. Zero unqualified uses.
- `git diff docs/product-overview.md` shows laws 2, 3, 5 with **zero** changed characters.
- `grep -n "toujours un sous-groupe" docs/product-overview.md` returns nothing.
- Laws in `README.md` and `docs/product-overview.md` are textually identical for law 1.

## Risks

- **Silent renumbering.** Deleting law 1 and shifting 2–5 up would invalidate every "law 4" citation
  in the repo. Replace in place.
- **Over-editing.** The revision shrank this job: it is one law rewritten, four words deleted, two
  sections reframed, three glossary entries. A wholesale rewrite of `product-overview.md` would
  exceed the ~400-line PR cap (G4) and bury the reviewable change.
- **§6 left dangling.** Skipping step 6 leaves `docs/README.md` asserting an assumption backed by a
  section describing a retired engine. Decide it, don't defer it.
