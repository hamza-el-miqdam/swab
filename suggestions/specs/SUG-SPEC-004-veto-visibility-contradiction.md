# SUG-SPEC-004 — L1 veto visibility: spec-kit artifact contradicts FS-06 (shown-without-override vs never-shown)

- **Area:** specs
- **Topic:** consistency
- **Impact:** high
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** ENV-03, ENV-04, FLT-02

## Problem / Opportunity

The three documents describing how a **veto absolu (L1)** contact appears in the FS-05 pre-send review disagree — and FS-05 is not yet implemented, so whichever text an implementer reads determines the UI:

- **FS-06 (authoritative):** L1 = "Excluded from resolution; does NOT appear in the revocable filtered list" (`docs/specs/FS-06-filtering.md:13`) and the acceptance criterion is unambiguous: "X appears **nowhere in the review UI** and not in `recipientIds` — including after any UI manipulation" (`FS-06:33`).
- **spec-kit artifact:** "a person excluded by the absolute veto rule **never shows an override control**" (`specs/001-envie-match/spec.md:27`, US1 scenario 3) and FR-004: "an absolute-veto exclusion MUST NOT expose an override control" (`spec.md:80`). Both phrasings imply the vetoed person **is rendered** in the review, merely without a button — the opposite of "appears nowhere".
- **FS-05:** ENV-04 "except veto absolu (FLT-02), which never appears as revocable" (`docs/specs/FS-05-envie-match.md:24`) is ambiguous between the two readings, and ENV-03's "shows the FULL resolution" (`FS-05:23`) can be misread as "all scope members including L1".

`spec.md:11` says "if the two ever diverge, FS-05 is authoritative and this file must be re-synced" — this is such a divergence. FS-06's property test (`FS-06:35`: `included ∪ filtered ∪ (L1-vetoed) = scope members`) confirms L1 members are a third, non-rendered set.

## Implementation plan

1. Edit `specs/001-envie-match/spec.md:27` (US1 scenario 3), replacing "a person excluded by the absolute veto rule never shows an override control" with: "a person excluded by the absolute veto rule (FLT-02) does not appear in the review at all — in neither the Included nor the Filtered list, with no override control anywhere (FS-06 L1 semantics)".
2. Edit `spec.md:80` (FR-004), replacing "an absolute-veto exclusion MUST NOT expose an override control (ENV-04)" with: "an absolute-veto (L1) exclusion MUST NOT appear in the pre-send review at all — neither list, no override control (ENV-04, FLT-02)".
3. Edit `docs/specs/FS-05-envie-match.md:23` (ENV-03), appending after "« Rien n'est masqué en silence. »": "(L1 veto-absolu members appear in neither list per FLT-02 — the review shows `scope members − L1`; the standing veto itself was user-authored, so law 2 holds.)"
4. Edit `FS-05:24` (ENV-04), replacing "which never appears as revocable" with "which appears nowhere in the review (FLT-02)".
5. Root `CHANGELOG.md` entry (`area:specs`); flag the FS-05/FS-06 wording changes to notion-liaison-specialist for the French mirror.

## Tests & acceptance criteria

- The three files give one consistent answer to "is an L1-vetoed contact rendered at send time?" — no.
- FS-06's acceptance criterion at `FS-06:33` needs no change (it was already correct) — verify the new FS-05/spec-kit wording cannot be read as contradicting it.
- Future check: the FS-05 E2E scenario for ENV-04, when written, must assert absence-from-review, not disabled-control.

## Risks & gotchas

- If `/speckit-plan` or `/speckit-tasks` has already been run for 001-envie-match, regenerate/patch downstream artifacts (none exist today — only `spec.md` + `checklists/requirements.md`).
- This is precisely the kind of product-behavior question G4 says not to guess: the resolution here follows FS-06's explicit acceptance criterion, not a new invention — cite FS-06:33 in the PR so review can confirm no product decision was made.
- Notion mirror: FS-05 and FS-06 are both mirrored; changed sentences need re-translation.
