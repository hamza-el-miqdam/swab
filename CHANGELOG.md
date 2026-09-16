# Changelog — repo root (area:devops · docs · agents · design · specs · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, design, specs, scripts, workspace config.
> Per-area history: [apps/ios](apps/ios/CHANGELOG.md) · [apps/android](apps/android/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets, ≤ ~15 lines per entry (G5). Updating the right changelog is part of every Definition of Done.

> Entries before 2026-08-15 are archived in [docs/archive/CHANGELOG-pre-2026-08-15.md](docs/archive/CHANGELOG-pre-2026-08-15.md) — moved, not deleted.
> Entries from 2026-08-15 to 2026-08-16 are archived in [docs/archive/CHANGELOG-2026-08-15-to-2026-08-16.md](docs/archive/CHANGELOG-2026-08-15-to-2026-08-16.md) — moved, not deleted.
> Entries from 2026-08-17 are archived in [docs/archive/CHANGELOG-2026-08-17.md](docs/archive/CHANGELOG-2026-08-17.md) — moved, not deleted.
> Entries from 2026-08-18 to 2026-08-19 are archived in [docs/archive/CHANGELOG-2026-08-18-to-2026-08-19.md](docs/archive/CHANGELOG-2026-08-18-to-2026-08-19.md) — moved, not deleted.
> Entries from 2026-08-21 to 2026-08-22 are archived in [docs/archive/CHANGELOG-2026-08-21-to-2026-08-22.md](docs/archive/CHANGELOG-2026-08-21-to-2026-08-22.md) — moved, not deleted.
> Entries from 2026-08-25 to 2026-08-26 are archived in [docs/archive/CHANGELOG-2026-08-25-to-2026-08-26.md](docs/archive/CHANGELOG-2026-08-25-to-2026-08-26.md) — moved, not deleted.

## 2026-09-16 — [FCH-06] update e2e-scenarios/e2e-coverage for the voided filter-consequence clause (#201, #204)

- **What:** `docs/qa/e2e-scenarios.md`'s and `docs/qa/e2e-coverage.json`'s FCH-06 entries no longer quote the retired "en pause → exclu par défaut à l'envoi" example as something to verify. The scenario keeps the surviving vocabulary-only Given/When/Then and marks the filter-consequence clause `~~struck~~` + **VOID 2026-09-16** (issue #201), matching the spec-level convention already used in `FS-03-contact-card.md` and `FS-06-filtering.md`. The coverage entry is kept (not deleted) with a new `void` status value on both platforms.
- **Why:** iOS PR #204 deleted the feature outright (`FicheFilterConsequence.swift` + tests, `filterConsequenceText`, `Fr.swift`'s `ficheEtatPausedConsequence`), per my own rule 5 (E2E traceability): a requirement clause going VOID, or its implementation being removed, updates these two docs in the same or the implementing PR — left undone in #202/#204, closed here.
- **Convention check:** searched for an existing precedent — other VOID'd requirements (`FS-06`'s `FLT-01/03/04/05/06/07`, `FS-05`'s `ENV-02/05/08/09`) were never added to `e2e-coverage.json`/`e2e-scenarios.md` in the first place (git history confirms no prior FLT-*/ENV-* entries), so there was no existing "retired requirement" representation to reuse in these two files. Added `void` as a new coverage status (documented in the manifest's `$comment`) rather than deleting the entry, matching G2's "honest classification, never silently dropped" and the spec-level VOID pattern (ID kept, marked, explained). `scripts/e2e-report.mjs` handles unknown statuses generically (no drift-guard special-casing beyond `automated`), so this is safe without a script change.
- **Follow-up, not in this PR:** Android still renders the false string pending issue #203; its coverage entry will need a fresh status once that PR lands.

## 2026-09-16 — [FCH-06] void the FS-06 filter-consequence clause of FCH-06 (closes #201)

- **What:** `docs/specs/FS-03-contact-card.md`'s `FCH-06` no longer requires the fiche to show a FS-06 "filter consequence" for the current état. That clause (e.g. "en pause → exclu par défaut à l'envoi") is struck through and marked VOID in place, with a note — the ID is not renumbered or deleted. The surviving half of FCH-06 (that `en pause` is a valid état value) is unchanged.
- **Why:** FS-06's 2026-09-13 narrowing (PR #182, ADR-002 `OQ-PRO-7` outcome B) retired `FLT-01`, the case-based état/ressenti default-rule system FCH-06 depended on. Only `FLT-02` veto absolu survives, and it's an explicit manual per-contact toggle set from the contact card — independent of état/ressenti. État now has zero automatic filtering consequence, so the displayed copy asserting one ("en pause → exclu par défaut") is false product copy, not just a stale doc comment.
- **Checked, no change needed:** `FS-06-filtering.md` doesn't reference FCH-06's consequence-display example anywhere, so no reciprocal edit there.
- **Follow-ups, not in this PR:** the live false string in `apps/ios/Sources/SwabCore/L10n/Fr.swift` (`ficheEtatPausedConsequence`) and `FicheFilterConsequence.swift` needs an area:ios PR; the identical string in Android's `Fr.kt` (`FICHE_ETAT_PAUSED_CONSEQUENCE`) needs a twin area:android issue + PR — a prior PR (#200) only fixed Android's doc-comment `FLT-01` citation, not the displayed string. `docs/qa/e2e-scenarios.md` / `e2e-coverage.json`'s FCH-06 entries (still quoting the old example) update in whichever implementing PR lands the code change.

## 2026-09-16 — [#186] docs(specs): retired 3-tier filter language in product-overview.md

- **What:** law 2's English gloss (line 16) no longer promises a "revocable at send" filter tier — reworded to describe the veto absolu as a standing, owner-managed boundary, matching FS-06's FLT-02. The `filtrage` glossary row (line 43) dropped the retired `exclu par défaut` / `priorité basse` tiers, now reads "Standing personal exclusion: veto absolu".
- **Why:** FS-06 was narrowed 2026-09-13 (PR #182, ADR-002 `OQ-PRO-7` outcome B) to veto-absolu-only; this doc still described the retired three-tier system (finding 8 from #182's review, out of that PR's scope). Tracked as issue #186.
- **Gotcha:** drafted by a local model (qwen3.8, via `ollama-router`'s `spec-and-ambiguity` profile) as a text-only proposal, then verified against the current file and FS-06's FLT-02 wording directly before applying — the model has no file-edit tools, so nothing lands automatically from that workflow.

## 2026-09-16 — [#196] docs: refresh ROADMAP.md after #196 merge

- **What:** `docs/ROADMAP.md`'s "last reviewed" line, critical-path diagram, and schema-queue table updated to reflect #196 (sync_seq UPDATE trigger) landing via PR #197 — 3a.0 marked done, 3a.1 (#185) and 3b (#189) marked unblocked.
- **Why:** the file's own header requires updating it whenever a tracked task starts, completes, or is re-sequenced (G5) — no separate issue, routine roadmap housekeeping.

## 2026-09-16 — review-specialist: posting findings to the PR is mandatory, not conditional

- **What:** `agents/review-specialist.md` now states explicitly that running `gh pr comment` is a required last step of every review, regardless of how the agent was invoked — handing findings back only as text to the caller does not satisfy the Definition of Done.
- **Why:** a review run this session produced a full verdict (PR #197 blocked by a failing `scope-guard` check) but returned it only as a report to the invoking session instead of posting it to the PR; nothing was recorded on the PR itself until posted by hand afterward.
- **Gotcha:** `.claude/agents/review-specialist.md` needs no regen — it `@`-imports `agents/review-specialist.md` at runtime. Ran `node scripts/render-agents.mjs` anyway to confirm (no diff produced for rendered files).

## 2026-09-16 — scope-guard: area-boundary checks downgraded to advisory (G4)

- **What:** `scripts/scope-guard.mjs` no longer exits 1 for an unlabeled PR or files outside the declared `area:*` scope — both now print a warning and exit 0. The `schema.prisma`-without-`area:db` hard gate is unchanged (still exits 1). `agents/_global-directives.md` (G4), `agents/devops-infrastructure-specialist.md`, `docs/agent-playbook.md` (DoD), and `docs/ROADMAP.md` updated to match; `scripts/scope-guard.test.mjs` updated for the new exit codes.
- **Why:** the repo is solo-maintained — cross-area PR blocking (opening an `area:db`-style proposal issue to yourself, splitting PRs purely to stay inside one area) was solving a multi-agent coordination problem that doesn't exist here. The `schema.prisma` single-writer gate stays hard, since it guards a real correctness risk (conflicting concurrent schema edits), not an organizational one.
- **Gotcha:** `.github/copilot-instructions.md` is a rendered verbatim copy of `agents/_global-directives.md` and is now stale (still has the old "auto-rejected" wording) — run `node scripts/render-agents.mjs` before this lands; CI's render-check (`ci.yml`) will fail otherwise. `.claude/agents/*` don't need regen (they `@`-import `_global-directives.md` at runtime, not a verbatim copy).

## 2026-09-14 — ROADMAP Phase 3 re-sequenced after ADR-002; #189 filed

- **What:** `docs/ROADMAP.md` Phase 3 rewritten:
  - a serial `area:db` queue: sync_seq trigger → #185 → #166 → #170 → #183
  - the cursor fix (#189), plus backend and mobile slices keyed to each schema item
  - founder sign-offs and a spec/code drift list

  Also refreshed: "Where we are", the critical-path diagram, the 0c next action, and four Phase 4 rows. `docs/STATUS.md` now links #189.
- **Why:** Phase 3 still sequenced the retired match engine and 3-tier filters, though Phase 0c finished on 2026-09-13.
- **Gotchas:**
  - `sync_seq` (#168) is a column `DEFAULT`, so it advances only on INSERT. Moving the cursor onto it as-is would silently drop edits, tombstones and role changes. #189 needs an `area:db` BEFORE UPDATE trigger first, and that issue is **not filed**.
  - No outbox table exists for PRO-10.
  - `.claude/worktrees/` is gitignored, not tracked as the old Phase 4 row claimed.

## 2026-09-14 — ROADMAP Phase 3 review fix pass (PR #190 review)

- **What:** fixes from an independent review of the 2026-09-14 Phase 3 rewrite:
  - 3a.0's trigger row now names all three `syncSeq` tables (`contact_links`, `contact_roles`, **`filter_rules`** — it was missing).
  - 3a.3's #170-before-#183 rationale is now marked a hedge, not a settled fact — neither issue commits to `PRO-25` extending `HistoryEvent`.
  - #92 (Prisma 7) moved out of "parallelizable" Phase 4 into the 3a queue (after 3a.4) — it shares the single-writer schema constraint.
  - Critical-path diagram: split the aggregated "backend slices" node so propositions no longer visually depends on history (3c never required it); added the missing outbox node.
  - `docs/STATUS.md`'s DB schema row no longer cites `FLT-01..08` as if current — FS-06 voided six of those eight IDs; reworded to `FLT-09, ex-FLT-01..08`.
- **Why:** the rewrite shipped ahead of its own review; these were the review's confirmed findings.
- **Not changed:** the changelog title convention nitpick — `## 2026-09-13 — ROADMAP Phase 2...` and `## 2026-08-27 — docs/ROADMAP.md: sequencing SSOT...` show pure-planning entries already omit `[REQ-IDs]` here.

## 2026-09-13 — [PRO-01..26] FS-05 rewritten as the proposition flow, ENV-* retired

- **What:** `docs/specs/FS-05-envie-match.md` fully rewritten (issue #180, stacked on unmerged #179):
  replaces the retired mutual-match engine with a directed, visible proposition model — `PRO-01..26`
  across emission (mobile), delivery/eligibility (backend), and response/convergence (both), plus an
  in-file `ENV-* → PRO-*`/VOID disposition table. `specs/001-envie-match/` marked superseded.
- **Why:** SUG-SPEC-016's gate cleared once the founder answered every ADR-002 open question
  (2026-09-13); Phase 0c.2 of the ADR-002 rollout. This PR's own review pass then added `PRO-26`
  (group-invite disclosure, `OQ-PRO-9`) and fixed dead links/cross-references.
- **Gotchas:** `docs/STATUS.md`'s FS-05 row updated (still ⚪ Not started — spec only). New `area:db`
  issue #183 blocks implementation. Two open questions need design + founder: `OQ-PRO-12`
  (accept-mode button copy), `OQ-PRO-13` (group-invite hint wording). `suggestions/db/SUG-DB-003`/
  `SUG-DB-006` marked VOID (target the retired `Match` model).

## 2026-09-13 — [FLT-02, FLT-09] FS-06 review fix pass — reword FLT-02, fix drop/visibility/directionality

- **What:** fixed every finding from #182's review. Reworded `FLT-02` to stand alone under the current
  model (dropped "L1"/FS-05-revocable-list references — founder's chosen path, not the reviewer's
  "keep + footnote" option). Clarified veto is outgoing-only (blocks the owner's sends, never blocks
  the vetoed contact's sends to the owner — that's FS-05 `PRO-08`) and that the owner still sees their
  own vetoed contacts (hidden only from sends/other parties). Unified `FLT-09` and its acceptance
  criteria on "silently dropped, `201`", removing the contradicting "rejected" wording. Fixed the law-2
  misquote, three broken links in `suggestions/done/specs/SUG-SPEC-018-*.md`, and leaked PR text in
  `suggestions/README.md`.
- **Why:** the review found FLT-02 unreadable alone, a silent-drop/rejected contradiction, and an
  owner-visibility ambiguity — founder-approved fixes, applied verbatim per the review comment.
- **Also:** filed 4 follow-ups the review asked for: #185 (`area:db`, slim `FilterRule`, linked from
  `FLT-09`), #186 (`area:specs`, stale `product-overview.md` copy), #187/#188 (`area:ios`/`area:android`,
  shipped comments citing retired `FLT-01`). Did not touch `schema.prisma` (data-steward only, #185).

## 2026-09-13 — [docs-hygiene] Archive 2026-08-25/26 entries; shorten OQ-PRO-1..11 entry

- **What:** review on PR #179 found this branch's own new entry ran 16 lines (G5 cap is ≤15) and,
  combined with sibling PRs #182/#184's own root-CHANGELOG entries, the file would exceed the 40,000-char
  `docs-hygiene-lint.mjs` cap once all three merge. Moved the eleven 2026-08-25/26 entries verbatim into
  a new `docs/archive/CHANGELOG-2026-08-25-to-2026-08-26.md` (same convention as the four existing
  archives) and trimmed the OQ-PRO-1..11 entry's wording without losing content.
- **Why:** archiving once here, ahead of #182/#184, unblocks both — each rebases onto this fix rather
  than archiving redundantly in its own branch.
- **Result:** 39,191 → 26,096 chars. `node scripts/docs-hygiene-lint.mjs` → PASS.

## 2026-09-13 — [FLT-02, FLT-09, OQ-PRO-7, OQ-FLT-2] FS-06 narrowed to standing personal boundaries (outcome B)

- **What:** executed [SUG-SPEC-018](suggestions/done/specs/SUG-SPEC-018-adr002-fs06-survival.md)'s "If (B)" path.
  `docs/specs/FS-06-filtering.md` rewritten around veto absolu: `FLT-02` kept (reworded in the fix-pass
  entry above); the L1-L3 rule-level/priority machinery (`FLT-01`, `03`–`08`) is retired via a
  disposition table, replaced by a single new `FLT-09` (server-side storage + enforcement, silent-drop
  on send, non-retroactive). `OQ-FLT-2` re-resolved server-side (was on-device 2026-08-22, argued about
  a broadcast model ADR-002 retired).
- **Why:** ADR-002's hand-assembled groups made silent rule-based subtraction from a broadcast incoherent;
  only the one standing per-contact boundary with real user protection behind it survives.
- **Also:** `docs/STATUS.md` FS-06 row, ADR-002's spec table + `OQ-PRO-7` row (executed note), `docs/ROADMAP.md`
  0c.4 row, and `suggestions/README.md` counts (018 moved to `done/specs/`) updated to match. FS-05's header
  already agreed (still depends on FS-06) — no edit needed there; its body rewrite is a separate, parallel PR
  (SUG-SPEC-016) which owns dropping the "Filtrés par tes règles" column from `PRO-03`/`PRO-04`.
- **Gotcha:** stacked on unmerged #179 — this diff includes files #179 already touches.

## 2026-09-13 — [OQ-PRO-1..11] ADR-002 open questions resolved by founder; Phase 0c gates cleared

- **What:** all nine `OQ-PRO-*` questions in [ADR-002](docs/decisions/ADR-002-envie-becomes-a-proposition.md),
  plus `OQ-PRO-10`/`OQ-PRO-11` found while drafting the Phase 0c plans, are answered. ADR-002 carries
  the full resolution table; SUG-SPEC-016 (FS-05 rewrite) and SUG-SPEC-018 (FS-06 survival) gates marked
  cleared/decided; `docs/ROADMAP.md` Phase 0c section, table, and mermaid diagram updated to match.
- **Why:** both plans were blocked on founder product decisions (silent accept/drop, group convergence
  cues, FS-06's fate, individual-vs-group targeting, etc.) — G4 forbids guessing product behavior.
- **Headline decisions:** OQ-PRO-6 convergence → named revealers + vague non-numeric cue for anonymous
  accepters, never a count (law 5). OQ-PRO-7 (FS-06) → **(B)**, narrowed to standing personal boundaries;
  veto absolu (`FLT-02`) survives, rule-priority machinery retired. OQ-PRO-10 → « Passer cette fois »
  reframed as a local hide, not a decline; G1(d) needs no amendment.
- **Gotcha:** SUG-SPEC-016's disposition table had reused `OQ-PRO-1` for an unrelated question
  (individual-vs-group targeting); now `OQ-PRO-11`. Next: spec-specialist executes 016/018, each its
  own issue/branch/PR (G4).

## 2026-09-13 — ROADMAP Phase 2: dependency queue cleared

- **What:** `docs/ROADMAP.md` Phase 2 now records what happened to each queued PR. Merged: #174 (it superseded #158), #175, #176, #123, #130, #120 (espresso 3.7.0, Android E2E 38/38 on API 34), plus the #177 Trivy fix. Closed into issues: #121/#122 → #56 (Android toolchain), #131 → #57 (Node 26).
- **Why:** ROADMAP is the sequencing source of truth. A stale "blocked" table would send the next session re-triaging closed PRs.
- **Gotcha:** the deferred bumps now live in issues #56/#57 (Phase 4 rows). Do them as part of those uplifts; don't reopen the Dependabot PRs.

## 2026-09-13 — [SUG-OPS-007] API prod image: `apt-get upgrade` to clear pcre2 HIGH CVEs in the Trivy gate

- **What:** the `prod` stage of `apps/api/Dockerfile` now runs `apt-get upgrade` before installing openssl. Archived the 2026-08-21/22 root entries to `docs/archive/` to stay under the 40,000-char cap.
- **Why:** `trivy-api-image` began failing every PR touching `apps/api`/`packages/db` (#130, #173) on `libpcre2-8-0` 10.42-1 (CVE-2026-86145, CVE-2026-89161, both HIGH, fixed in 10.42-1+deb12u1). The pinned `node:22-slim` digest — and the latest upstream tag — still ship 10.42-1, so a digest bump alone doesn't fix it.
- **Gotcha:** the job is skipped on pushes to `main` unless API image inputs changed, so a new base-image CVE surfaces first on an unrelated PR. Only the prod stage upgrades; `base`/`dev`/`build` are never scanned or deployed.

## 2026-08-30 — [ADR-002] Phase 0c.3 — PR #167 re-review fixes: glossary wording + FS-04 Agents header (SUG-SPEC-017)

- **What changed:** two Medium findings from PR #167's second review pass, both fixed in one push. (1) `README.md` and `docs/product-overview.md` still described `sous-groupe`/subgroups as FCA-only ("pin/rename/hide only", "on-device FCA subgroups") — now false since SUG-SPEC-017 made manual create/rename/edit-membership/delete the primary path; both the "In:" MVP-scope line and the `sous-groupe` glossary row updated in each file, following the precedent PR #162 set for updating glossary rows in the same PR that changes the underlying spec. (2) `docs/specs/FS-04-subgroups.md:3`'s `Agents:` header still read "iOS + Android (sole...)"; added Backend, following FS-06's header pattern, since `SGR-15a` requires server-persisted owner-scoped `Group`/`GroupMember` storage. Also folds in the untracked `docs/STATUS.md` line-length trim from the PR's first review pass (`d12d55d`, no changelog entry at the time — recorded here).
- **Why:** G5 — docs must never disagree with the spec they describe; a reader hitting the README/product-overview before FS-04 would learn a stale, now-inaccurate model.
- **Verified:** `grep -n "pin/rename/hide only" README.md docs/product-overview.md` → no hits.

## 2026-08-29 — [ADR-002] Phase 0c.3 — amend FS-04 (SGR-10..SGR-15): manual CRUD, FCA demoted to suggestion (SUG-SPEC-017)

- **What changed:** `docs/specs/FS-04-subgroups.md` amended (not rewritten) per ADR-002 commitment 3. Purpose/user-stories reframed: manual group creation is now the primary path. `SGR-01`/`SGR-04` updated in place — FCA now produces *suggestions* only, never a user's groups directly. New `SGR-10..SGR-15`: manual create/rename/edit-membership/delete, the owner-privacy invariant (no notification, no membership list, ever — G1(a)), accepting a suggestion into an ordinary group, and `SGR-15` — the explicit server-vs-device persistence split (manual groups are server-persisted owner-scoped rows; the FCA lattice stays on-device, `OQ-SGR-2` not reopened). `SGR-07`, `SGR-08`, `SGR-09a/b/c`, and the Ana/Ben/Chloé/Dan worked example's data are byte-identical (verified by `git diff`); only the worked example's closing sentence lost its now-false "tu ne définis jamais un groupe à la main" framing.
- **Why:** the first ADR-002 draft implied FS-04 needed a full rewrite; the 2026-08-27 revision made that false — groups stay owner-private, so the privacy/parity requirements already held. Only manual CRUD and the FCA-suggestion demotion are new, and the persistence split needed writing down explicitly before an implementer reads `OQ-SGR-2` and ADR-002's schema section as contradicting each other.
- **Gotchas:** opened `area:db` issue [#166](https://github.com/hamza-el-miqdam/swab/issues/166) proposing `Group`/`GroupMember` as owner-scoped models (no existing open issue covered them; SUG-SPEC-016 step 5 hasn't landed) — FS-04 implementation is blocked on it. `docs/specs/vectors/fca-test-vectors.json` deliberately still doesn't exist (forward reference, not a bug — SGR-09). No `docs/qa/e2e-*` manifest changes: FS-04 is still ⚪ Not started, same precedent SUG-SPEC-016 recorded for FS-05.
- **Verified:** `grep -n "jamais un groupe à la main" docs/specs/FS-04-subgroups.md` → no hits; `SGR-01`..`SGR-09` numbering untouched, new IDs start at `SGR-10`; `docs/STATUS.md` FS-04 row and `docs/ROADMAP.md` 0c.3 row updated.

## 2026-08-29 — [ADR-002] Phase 0c.1 — retire "encrypted vault" wording, add scope-guard test coverage (PR #162 re-review)

- **What changed:** third review pass on PR #162 (Approve, two non-blocking findings) flagged that `docs/product-overview.md`/`README.md` still described the MVP scope as shipping "encrypted vault sync" and carried a glossary "vault" row describing an on-device encrypted store with an opaque server blob — both stale, ADR-001-violating claims sitting in lines this PR already touches. Reworded the MVP scope line to "server-synced classification data (device cache, per-record last-write-wins)" in both files; rewrote the glossary "vault" row to a strikethrough **RETIRE** entry pointing at ADR-001, mirroring the existing "match" row's convention. Also added the missing `scope-guard.test.mjs` coverage for the `docs/product-overview.md`/`docs/README.md`/`docs/archive/` paths added to `AREA_PREFIXES` in the 08-28 entry below (one negative test pinning `area:db` out, two positive tests for `area:specs`/`area:devops`), mirroring the PR #161 precedent pattern.
- **Why:** ADR-001 (2026-08-16) retired E2EE and the opaque vault blob; leftover "encrypted"/"opaque blob" language in the two most-read repo-root docs contradicts the product's own privacy law 4 in the same files. The scope-guard gap meant the newly-granted paths had no regression pinning, unlike every other `AREA_PREFIXES` entry.
- **Verified:** `node --test scripts/scope-guard.test.mjs` (42/42 pass); `node scripts/docs-hygiene-lint.mjs` PASS; `LABELS="area:specs area:devops" BASE=3b578c4 node scripts/scope-guard.mjs` PASS; grep for "encrypted vault"/"E2EE"/"end-to-end encrypt" across both files shows only the intentional "we never claim end-to-end encryption" disclaimers.

## 2026-08-28 — [ADR-002] Phase 0c.1 — rewrite product law 1, sync README + docs/README (SUG-SPEC-015)
- **What changed:** docs/product-overview.md law 1 rewritten (mutual-reveal → directed proposition), law 4's "reveal is strictly mutual" clause removed, §1/§3/glossary synced to the proposition model (envie/portée/match). README.md brought into sync: same law 1 wording, law 4's matching clause removed, MVP scope line, glossary rows for envie/portée/match, and the "Core Concepts" bullets (still describing the retired vault/matching engine) rewritten to match ADR-001/ADR-002. docs/README.md's "current global assumptions" line trimmed to the one still-open assumption (phone-OTP identity). scripts/scope-guard.mjs gained the three paths this PR needed (docs/product-overview.md, docs/README.md, docs/archive/) under area:specs/area:devops, same pattern as PR #161's fix. Review found the Vision paragraph (both files) and §3/§6 of product-overview.md still said recipients "learn about it only if they reveal themselves" — inverted from ADR-002 (visibility is unconditional; only identity-toward-other-recipients is optional) and self-contradicting law 1 — reworded all four spots.
- **Why:** ADR-002 retired mutual reveal/matching on 2026-08-27; these were the last repo-root docs still asserting it as current behavior. Executes SUG-SPEC-015. The reveal-language bug evaded the SUG's own "revealed"/"mutual" grep because it used the word "reveal" instead.
- **Verified:** laws 2/3/5 unchanged in both files; `scope-guard.mjs` passes with area:specs+area:devops; bare-word grep for "reveal" across both files now shows only the corrected, ADR-002-consistent phrasing plus explicit retirement notes.

## 2026-08-27 — [ADR-002] Phase 0b follow-up — narrow the CLAUDE.md/README.md/ROADMAP.md scope-guard fix (review on PR #161)

- **What changed:** a "Request Changes" review on PR #161 correctly flagged the entry below: `CLAUDE.md`/`README.md`/`docs/ROADMAP.md` had been added to `SHARED_ALLOWED_PREFIXES`, a bucket applied to **every** `area:*` label at once — not just `area:specs`/`area:devops`, which are the only areas that actually author these files. That let, e.g., an `area:db`-labeled PR silently edit `CLAUDE.md`'s own Hard Boundaries without review catching it, defeating the guarantee G4 exists to give. Moved the three paths into `AREA_PREFIXES["area:specs"]` and `AREA_PREFIXES["area:devops"]` instead (this PR carries both, so it still passes); updated the header comment to state the general rule going forward (governance text that defines authority is scoped narrowly into the areas that author it, never dropped into the shared bucket, which stays reserved for files structurally owned by none — a lockfile, a status board).
- **Why:** `SHARED_ALLOWED_PREFIXES` and `AREA_PREFIXES[area]` look interchangeable but aren't — the former is a blanket grant, the latter is scoped. Mixing them up silently widens every area's write access, which is exactly the class of bug scope-guard exists to prevent in others' PRs.
- **Verified:** added two positive tests (`area:specs`/`area:devops` touching the three files) and one negative test (`area:db` touching them alongside `schema.prisma` — the three files escape, the schema itself doesn't since `area:db` is present) to `scope-guard.test.mjs`, mirroring the existing `agents/*.md is not silently granted to unrelated areas` case. 39/39 pass; `docs-hygiene-lint` and `render-agents.mjs --check` still clean; re-ran the real PR diff — `area:specs` alone still correctly fails on `.github/`/`agents/`/`scripts/`, `area:specs area:devops` passes.

## 2026-08-27 — [ADR-002] Phase 0b follow-up — close scope-guard's CLAUDE.md/README.md/ROADMAP.md gap; fix pre-existing STATUS.md lint failure (PR #161)

- **What changed:** two unrelated CI failures found on PR #161, both fixed in the same push. (1) `scope-guard.mjs`'s own header comment flagged `CLAUDE.md`, `README.md`, `docs/ROADMAP.md` as unmapped repo-root governance docs (issue #147 had only closed the other two named gaps); added all three to `SHARED_ALLOWED_PREFIXES` with rationale, following the #147 pattern, and updated the header comment so it stops pointing at a gap that's now closed. (2) `docs/STATUS.md` lines 21 and 31 exceeded the 450-char `docs-hygiene-lint` budget (G5) — pre-existing on `main` since the two prior ADR-002 doc commits, unrelated to this PR's own diff; trimmed both rows without losing information.
- **Why:** PR #161 legitimately touches `.github/`, `agents/`, `CLAUDE.md`, `README.md`, `docs/ROADMAP.md` under the `area:specs` label alone (a binding-directives amendment necessarily touches its own propagation targets); the `area:devops` label plus this fix is what actually closes the escape — verified locally against the real PR diff (`LABELS="area:specs area:devops"` passes, `area:specs` alone still fails on `.github/`/`agents/` as expected). The STATUS.md fix was bundled here rather than filed separately because it's a trivial two-line trim in an already-shared-allowed file, and it was silently blocking merge of every PR on the repo (`ci` is a required branch-protection check).
- **Verified:** `node scripts/docs-hygiene-lint.mjs`, `node --test scripts/scope-guard.test.mjs` (36/36), `node scripts/render-agents.mjs --check` all pass; scope-guard re-run against the actual `origin/main...HEAD` diff passes with `area:specs area:devops`.

- **What changed:** second pass on the same branch (`docs/adr002-phase0b-amend-directives`), authorized via [issue #160](https://github.com/hamza-el-miqdam/swab/issues/160). Amended the independently-written "reveal stays strictly mutual" prose in `agents/backend-systems-specialist.md:30`, `agents/review-specialist.md:64`, and `agents/spec-specialist.md:34` (the entry below's own "Gotcha" flagged these as out of scope for the first pass) to the same G1(d) proposition-model language, adapted to each file's sentence. Re-ran `node scripts/render-agents.mjs`, propagating to `.github/instructions/backend.instructions.md` and `.github/instructions/specs.instructions.md` (`review-specialist` has no rendered Copilot copy by design — `copilot: false`); `--check` clean. Refreshed `docs/ROADMAP.md`'s Phase 0b section to past tense/done.
- **Why:** the first pass correctly stayed inside spec-specialist's declared scope (only `agents/_global-directives.md` is that agent's to edit); this pass was the explicitly-authorized follow-up to close the gap so no `.md` in the repo still asserts the retired mutual-reveal invariant as current policy.
- **Verified:** `grep -rn "strictly mutual" --include="*.md" .` now returns only allowed historical references — this CHANGELOG, `docs/decisions/ADR-002-*.md`, `docs/archive/`, and SUG-SPEC-014.

## 2026-08-27 — [ADR-002] Phase 0b — amend G1(d) to legalize the proposition pivot (SUG-SPEC-014)

- **What changed:** `agents/_global-directives.md` G1(d) rewritten from "reveal stays strictly mutual" to the proposition-model wording (directed + visible to recipients, proposer always named, silence never explained, no decline action, per-recipient identity reveal by choice, owner-private groups). The "## Project" one-liner rewritten to the proposition model too. Re-rendered via `node scripts/render-agents.mjs` (`.github/copilot-instructions.md` updated). `.specify/memory/constitution.md` resynced — Principle I clause (d) matches, version bumped **2.0.0 → 3.0.0** (MAJOR — a redefinition, matching the ADR-001 precedent). `CLAUDE.md`'s app description + a new Hard Boundaries line on group privacy. `README.md:15` gets a superseded-marker only (full law-1 rewrite is SUG-SPEC-015).
- **Why:** this file is prepended to every agent prompt; until (d) was amended, any agent (including a review-specialist pass) was *required* to reject ADR-002 work as a privacy violation. ROADMAP Phase 0b — blocks all downstream ADR-002 work.
- **Verified needing no change:** G1(a)/(b)/(c) — satisfied by ADR-002 commitments 3–5 already; not touched.
- **Known tension flagged, not resolved:** OQ-PRO-10 — the new (d) says "no decline action anywhere", but FS-05's planned « Passer cette fois » is a decline with zero signal. Left as-is per the plan; founder decides during the FS-05 rewrite.
- **Gotcha for the next reader:** `agents/backend-systems-specialist.md`, `agents/review-specialist.md`, `agents/spec-specialist.md`, and their rendered `.github/instructions/*.md` copies still contain their own independent "reveal stays strictly mutual" / "reveal is strictly mutual" prose — these are *not* sourced from `_global-directives.md` G1(d) and were out of scope for this PR (SUG-SPEC-014's 8 steps don't cover them). They still need updating; tracked as a follow-up, not silently missed.

## 2026-08-27 — [ADR-002] Phase 0b/0c execution plans (SUG-SPEC-014..018)

- **What changed:** five sequenced plan files under `suggestions/specs/`, one per roadmap step, each in the standard SUG template (`file:line` evidence, numbered plan executable without re-investigating, acceptance greps, risks). 014 amend G1(d) + re-render + constitution resync → 015 product laws + glossary → 016 FS-05 rewrite → 017 FS-04 amendment → 018 FS-06 survival. `docs/ROADMAP.md` Phase 0b/0c link them; `suggestions/README.md` counts updated (35 open / 121 total).
- **Why:** ADR-002 named *what* changes but not *how*, and the pivot's blast radius spans specs, agent prompts, spec-kit artifacts, seed data and two void `SUG-DB-*` files — too much to hold in a head or a roadmap bullet.
- **016 carries the load-bearing artifact:** an `ENV-* → PRO-*` disposition table for all 20 requirements. **Six survive** (ENV-06, 11, 15, 16, 18, 20) — they are about calm and silence, not matching, and ENV-11 is the direct ancestor of the amended G1(d). A clean-slate rewrite would drop them by omission.
- **Two collisions found while planning, both unresolved and flagged, not guessed:** (1) **OQ-PRO-10** — G1(d)'s *"no decline action anywhere"* vs FS-05's « Passer cette fois », a decline that emits zero signal; if it survives the clause needs *"…that the proposer can observe"*. (2) **FS-04 persistence split** — `OQ-SGR-2` (FCA lattice never persisted) and ADR-002 (`Group`/`GroupMember` are server rows) are both true, of different objects; FS-04 must say so or an implementer will contradict one.
- **Gotchas:** 014 is blocking — no other plan may start first. 016 is gated on OQ-PRO-6 + OQ-PRO-1 (founder). Schema work stays a handoff to `area:db` in every plan (G4, one writer). `docs/qa/e2e-coverage.json` verified to hold **zero** `ENV-` references — no manifest work needed, don't re-check.

## 2026-08-27 — [ADR-002] an envie becomes a proposition; mutual reveal is retired

- **What changed:** added [docs/decisions/ADR-002-envie-becomes-a-proposition.md](docs/decisions/ADR-002-envie-becomes-a-proposition.md) — founder decision. An envie is now a directed, visible **proposition** (what/when/where) answered by accept / counter-propose / ignore; Swab shows the group's responses but never ranks, tallies, or decides. The matching engine will not be built. `docs/ROADMAP.md` Phase 0 re-cut and its Phase 3 marked superseded.
- **Why:** reaching FS-05 on the roadmap meant answering five parked questions (OQ-ENV-1/2/3, ENV-17, ENV-19). Presenting them surfaced that all five presupposed a matching engine the founder does not want — so they are **dissolved, not answered**.
- **⚠️ Revised the same day, after the first version was pushed:** the group model in commitments 3–5 was corrected and the pivot is now **much smaller**. Groups are **private to their owner** — creating one or adding someone notifies nobody. A recipient learns only that the proposer « a envie de te voir » plus that a few others are invited (**no number** — law 5 stays untouched), and reveals their identity to the other recipients only by choosing to; the proposer always sees who accepted, and the copy must say so. Anything describing groups as *shared* or *visible to their members* is void.
- **⚠️ Blocks all product implementation:** `agents/_global-directives.md` G1(d) still reads *"reveal stays strictly mutual… must not disclose a one-sided envie to anyone"*. It is prepended to every agent prompt, so until it is amended every agent must reject this work. **Exactly one clause changes** — G1(a)'s « X t'a ajouté » prohibition survives intact; do not widen it. Order: amend → `node scripts/render-agents.mjs` → `/speckit-constitution` → `CLAUDE.md`.
- **Survives the pivot, do not drop:** silence is still never explained (ENV-11's purpose, reinstated), no decline button, law 5's no-counters, IDT-08, IDT-01, opaque `verb`, and FS-04's owner-private groups.
- **Follow-ups:** FS-05 full rewrite + FS-04 *amendment* (not rewrite) + FS-06 survival decision (`area:specs`); `Match`/`MatchState` are dead schema, and `Group`/`GroupMember` (owner-scoped, never readable by a member) + a per-recipient `revealed` flag + time/place options are needed (`area:db`). Nine open questions OQ-PRO-1..9; **OQ-PRO-6 is now the hardest** — with no per-slot counters and anonymous accepters allowed, it is unclear what a recipient sees that lets a group converge at all.

## 2026-08-27 — docs/ROADMAP.md: sequencing SSOT + IDT-03 trust-proxy security finding

- **What changed:** added [docs/ROADMAP.md](docs/ROADMAP.md) — the counterpart to STATUS.md ("what is done") answering "what is next, in what order, and how", with a plan card per task. Linked from `docs/STATUS.md`; corrected two STATUS lines that had drifted (the schema row understated the FS-05 models already present; the FS-05 row implied a dependency that ENV-05 removes).
- **Why:** sequencing lived only in session context and was being re-derived (wrongly) each time. Two errors it now prevents: FS-05 was assumed to come *before* FS-04/FS-06 (its header says the opposite), and the FS-05 *backend* was assumed blocked on both (ENV-05 has the client send a resolved `recipientIds` list, so it is not).
- **Security finding (Phase 1, highest priority):** fastify **5.12.1** — a patch release, in Dependabot PR #158 — deliberately neutralises numeric `trustProxy` ("Hop-count-only trust cannot validate the immediate peer. Fail closed…") and drops `number` from its type union. That is exactly the pattern IDT-03 uses at `apps/api/src/app.ts:86`, and it is the sole root cause of #158's 9 typecheck errors and its deterministic `auth.test.ts:238` failure — the test asserts the now-unsafe behaviour. `apps/api/CHANGELOG.md:109`'s "spoof-resistant unlike `trustProxy: true`" rationale is falsified: a directly-connected client can forge enough hops to mint a fresh rate-limit bucket.
- **Exposure:** low — `TRUST_PROXY_HOPS` defaults to `0` (fail-closed) and nothing is deployed. Fix before first deploy; replace the hop count with a CIDR/IP allowlist in its own `area:api` PR, not bundled into #158.
- **Gotcha:** every Dependabot PR fails the scope guard until an `area:*` label is applied by hand.

## 2026-08-27 — [FCH-04] FS-03 reconciled with the device-side history trim actually shipped

- **What changed:** `docs/specs/FS-03-contact-card.md` FCH-04 rewritten with the file's existing ⚠️ Transitional (ADR-001) Current/After convention (matches FCH-01, FCH-09). It now acknowledges the device-side 12-month history trim (`Vault.recordAxisEdit`, Android PR #108/SUG-AND-013, iOS PR #107) as a deliberate interim stopgap — founder decision 2026-08-21 — driven by the live 1MB vault cap (`MAX_VAULT_BYTES`, `apps/api/src/routes/vault.ts:13` + DB `CHECK`), records the clock-skew corroboration guard both platforms now carry (Android from the start, iOS via #137/issue #113), and states the removal condition: deleted once server-side retention ships as part of ADR-001 Stage 3 (history slice), tracked in issue #110.
- **Why:** the spec previously read as though server-side retention already existed; it did not, and code-reality (device-side trim, live on both platforms) had diverged from spec text since #107/#108 landed.
- **Not in this PR:** #110's code-removal sub-tasks (deleting the trims from `Vault.kt`/`Vault.swift`, fixing the stale `VLT-03` label in `apps/api/src/routes/vault.ts:13`) — blocked on ADR-001 Stage 3 history landing, tracked separately in #110. `docs/specs/.notion-sync.json`'s FS-03 mirror is now further behind current English; resync is notion-liaison-specialist's job, not done here.
