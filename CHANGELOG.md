# Changelog — repo root (area:devops · docs · agents · design · specs · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, design, specs, scripts, workspace config.
> Per-area history: [apps/ios](apps/ios/CHANGELOG.md) · [apps/android](apps/android/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets, ≤ ~15 lines per entry (G5). Updating the right changelog is part of every Definition of Done.

> Entries before 2026-08-15 are archived in [docs/archive/CHANGELOG-pre-2026-08-15.md](docs/archive/CHANGELOG-pre-2026-08-15.md) — moved, not deleted.
> Entries from 2026-08-15 to 2026-08-16 are archived in [docs/archive/CHANGELOG-2026-08-15-to-2026-08-16.md](docs/archive/CHANGELOG-2026-08-15-to-2026-08-16.md) — moved, not deleted.

## 2026-08-26 — [#147] scope-guard: area:specs covers docs/agent-playbook.md + docs/decisions/; sre/devops covers agents/

- **What changed:** (1) added `"docs/agent-playbook.md"` and `"docs/decisions/"` to `AREA_PREFIXES["area:specs"]`, mirrored in `agents/spec-specialist.md`'s Scope section (narrow: process-doc/ADR corrections only when an issue explicitly directs it). (2) Added `"agents/"` to `area:sre`/`area:devops` — hit directly while landing (1), since editing `agents/spec-specialist.md`'s Scope section is itself a mapping-sync commit only sre/devops was set up to make. Both were the two concrete gaps the script's own header comment named as unmapped cross-cutting debt; the header now records issue #147 closed them. 6 new table-driven cases in `scope-guard.test.mjs`. Regenerated `.github/instructions/specs.instructions.md` via `node scripts/render-agents.mjs` (`.claude/agents/*.md` are `@`-import wrappers, unaffected).
- **Why:** PRs #145/#146 — both closing `area:specs`-labeled issues (#116, #115/#132) the founder filed — were failing scope-guard for touching exactly the first set of paths; fixing that then failed scope-guard on this very PR for touching `agents/spec-specialist.md`.
- **Gotcha:** `"agents/"` under sre/devops covers *mapping-sync* edits (keeping `AREA_PREFIXES` and a Scope section in agreement), not persona/behavior authorship — that judgment call stays with each area in review. `docs/decisions/ADR-001-*` stays append-only (dated correction notes, never a silent rewrite) per `agents/review-specialist.md`'s founder-attention flag.

## 2026-08-26 — [VLT-09] FS-07: amend conflict resolution to compare-and-swap, specify stale-edit UX

- **What changed:** `docs/specs/FS-07-identity-vault.md` VLT-09 no longer says "field-level LWW by server `updatedAt`" — it now describes the shipped compare-and-swap semantics: wire shape `{ value, baseUpdatedAt }`, applied iff the stored field timestamp equals the client's base (`null` == `null`), otherwise the stored value wins and the field returns in `staleFields`. VLT-08's cursor wording gained a clarifying sentence (opaque, inclusive-of-millisecond, re-send-not-skip). Added a "Stale-edit UX" section (⚠️ ASSUMPTION default: surface the winning value inline, keep the user's rejected edit available to knowingly re-apply, never auto-retry/auto-overwrite) plus a new acceptance criterion and `OQ-VLT-3` tracking founder/design sign-off on the actual copy.
- **Why:** #132 — the API (#124, `apps/api/src/prisma-contacts-repo.ts:209-230`) never implemented wall-clock LWW because VLT-08 forbids trusting client clocks, so there was no second timestamp to compare against. The spec text was unbuildable as written and, per the issue, would have led a Stage-4 client implementer to send the wrong wire shape or misuse `baseUpdatedAt`.
- **Gotcha:** the stale-edit UX mechanism is a buildable default, not frozen French copy — do not ship it as final microcopy; `OQ-VLT-3` needs an explicit founder/design answer before FS-01/FS-03 Stage 4 work locks it in.

## 2026-08-26 — [#65] scope-guard: fix stale-PR false positives from the merge-ref checkout

- **What changed:** `.github/workflows/scope-guard.yml` now checks out `github.event.pull_request.head.sha` directly (falls back to `github.ref` for `workflow_dispatch`), instead of `actions/checkout`'s default `refs/pull/N/merge`.
- **Why:** the merge ref is the PR head merged with main's *current* tip, but `BASE` (`pull_request.base.sha`) stays pinned to main as it was when the PR last synced. `base...HEAD` then included every commit merged to main since, wrongly blaming an open PR for files it never touched — the `schema.prisma` hard gate failed loudly; the escaping check failed the same way and could also wrongly *allow* a PR whose apparent scope widened.
- **How:** `scripts/scope-guard.mjs`'s `getChangedFiles` was untested — the bug lived entirely in what HEAD the workflow handed it, not its diff logic. Exported it with an optional `{ cwd }` for testing and added two `scope-guard.test.mjs` cases against a throwaway temp git repo: one reproduces the merge-ref leak, one confirms a plain head-SHA checkout excludes it.
- **Gotcha:** `ci.yml`'s `changes` job has the same shape of staleness in its two-dot path-filter diff, but a false positive there only triggers an extra native test suite — left as a follow-up, out of scope for #65.

## 2026-08-26 — [#141] scope-guard: shared docker-compose.yml + fail-closed unlabeled PRs

- **What changed:** (1) `docker-compose.yml` added to `SHARED_ALLOWED_PREFIXES` — a backend-owned change (e.g. an env var) can now touch it without also carrying an `area:sre`/`area:devops` label. (2) Removed the SUG-OPS-002 step 3 warn-and-pass grace period: an unlabeled PR now fails closed (`process.exitCode = 1`), with a message naming every valid `area:*` label.
- **Why:** #139's backend-owned `OTP_RATE_LIMIT` change only passed scope-guard by carrying two labels, discovered by trial (#140/#141). Separately, the ~2026-08-17 bake-in week for the grace period lapsed unflipped — PR #138 merged fully unlabeled with scope-guard silently reporting SUCCESS.
- **How:** extracted `describeResult(labels, changedFiles)` as a pure decision function (exit code + message) out of `main()`, so both new behaviours are unit-testable without shelling out to git. `suggestions/done/devops/SUG-OPS-002-codeowners-scope-guard.md` records step 3 as complete.
- **Closes:** #141; #140 closed as a duplicate.

## 2026-08-25 — [docs-hygiene] Archive 2026-08-15/16 entries out of root `CHANGELOG.md`

- **What changed:** moved the 11 entries dated 2026-08-15 and 2026-08-16 (contiguous block at the bottom of the file) verbatim into a new `docs/archive/CHANGELOG-2026-08-15-to-2026-08-16.md`, same pattern as the existing pre-2026-08-15 archive. Live file's header gets a second pointer line.
- **Why:** 31,131 / 40,000 chars (78%) of `docs-hygiene-lint.mjs`'s whole-file cap, growing ~1.7 entries/day — closest of any changelog to tripping `MAX_CHANGELOG_CHARS`. Pre-emptive, not a fix for a live break.
- **Result:** 31,131 → 13,586 chars (34% of cap). Nothing deleted — archived entries stay verbatim in git and in the new file; the ADR-001 "retire E2EE" decision they include stays separately durable in `docs/decisions/ADR-001-server-side-classification-data.md`. `node scripts/docs-hygiene-lint.mjs` → PASS.

## 2026-08-25 — [docs-hygiene] Trim `docs/STATUS.md` CI and Design system rows

- **What changed:** trimmed the CI row (448/450 chars) and Design system row (434/450 chars) in `docs/STATUS.md` — dropped prose/mechanism detail already recorded elsewhere, kept the outcome facts.
- **Why:** both were within single-digit chars of `docs-hygiene-lint.mjs`'s 450-char row cap; any future PR appending even a short clause would trip CI. Pre-emptive, not a fix for a live break.
- **Result:** CI row 448→270 chars, Design system row 434→329 chars. `node scripts/docs-hygiene-lint.mjs` → PASS.

## 2026-08-25 — Repo hygiene: prune stale worktrees, split `suggestions/README.md`

- **What changed:** (1) removed 3 stale `.claude/worktrees/*` subagent worktrees whose branches had already merged to `main` (`android/sug-and-001-vlt04-sync-triggers` #126, `feat/api-vlt-07-09-typed-contact-classification-api` #124, `ios/sug-ios-002-vlt04-sync-triggers` #125) — reclaimed 1.5GB, verified each was clean (`git status --short`) before `git worktree remove --force`. (2) Extracted the one-time "Execution order — dependency graph & model assignments" section (mermaid wave/track plan from the 2026-07-20 audit triage) out of `suggestions/README.md` into a new `suggestions/execution-order.md`, byte-identical content, replaced with a 1-line pointer.
- **Why:** both were pure context/token-hygiene cost reduction — the worktrees were dead weight on every repo-root `find`/`grep`; the execution-order section was read-whole on every `suggestions/README.md` load (5× in one session) despite being one-time planning narrative, not the day-to-day per-area lookup tables.
- **Result:** `suggestions/README.md` drops from 38,151 → 24,477 chars. Open/done counts (30/86) unchanged since 2026-08-21 — verified, not re-derived.
- **Gotcha:** worktree branch names looked like they matched `git branch --merged main` only because they were currently checked out there (`+` prefix); recent merge commits (`aad1380`, `09bae9f`, `9f086e2`) confirmed all three landed before removal.

## 2026-08-22 — [OQ-FLT-2] Filter evaluation site is settled: on-device, two implementations

- **What changed:** `docs/specs/FS-06-filtering.md` records **OQ-FLT-2 as RESOLVED — on-device**. Also drops the two now-dead conditionals it left behind: FLT-06's "and mirrored server-side if resolution runs there (ENV-05)", and the header's Backend scope "evaluation if resolution runs server-side" (Backend is rule storage only). `docs/STATUS.md`'s FS-06 note updated to match.
- **Why:** bookkeeping, not a new decision. FS-05 `ENV-05` was corrected on 2026-08-16 to mandate on-device resolution; OQ-FLT-2 still carried the retracted premise that "ENV-05 now permits either". The structural reason is that the server stores filter rules (FLT-06) but **not** subgroup membership — the lattice is derived on-device and never persisted (SGR-07, OQ-SGR-2, VLT-01) — so it cannot resolve a portée on its own.
- **Consequence for implementers:** `applyFilters` needs **exactly two** implementations, Swift + Kotlin. **No TypeScript evaluator.** The shared cross-platform test vectors are still required and must lock both — in a **new** file; `docs/migration/vault-test-vectors.json` is historical per ADR-001 and MUST NOT be extended.
- **FS-06 stays ⚪ Not started** — the ambiguity is removed, the feature is not begun.
- **Gotcha:** ADR-001's "Enabling" section still says filtering/subgroups/matching *can* be computed server-side. That bullet is the over-generalisation ENV-05's correction note retracts; it was left as-is (ADRs are historical records) — read ENV-05 and OQ-FLT-2 as the current rule, not that line.
- **Not done here:** OQ-FLT-1 (which cases ship default rules) is still genuinely open. The French Notion mirror was not re-synced — deferred until the ADR-001 spec review settles, per `docs/STATUS.md`.

## 2026-08-21 — Reconcile `suggestions/` open-vs-done bookkeeping

- **What changed:** moved seven shipped suggestions into `done/<area>/` — `SUG-IOS-004` (#105), `SUG-IOS-005` (#103), `SUG-IOS-007` (#107), `SUG-IOS-009` (#111), `SUG-IOS-012` (#104), `SUG-AND-010` (#109), `SUG-AND-012` (#102) — and updated `suggestions/README.md`: iOS 6 open/12 done, Android 2 open/16 done, **32 open / 84 done** (116 total, unchanged). Also fixed two `SUG-AND-013` links left pointing at its old path by #108.
- **Why:** all seven had shipped with changelog entries but were still filed as open, so the README overstated remaining work by seven and several links 404'd. The drift was flagged in #108; this is the sweep it asked for.
- **Resolution notes** added to `SUG-IOS-009` and `SUG-AND-010`, the two reviewed in depth at merge time. The other five were merged in earlier sessions and were moved without back-filling notes rather than inventing detail — the shipped behaviour is recorded in their area changelogs.
- **Gotcha for future PRs:** moving the file is the *implementing* PR's own bookkeeping, and the scope guard permits it from any area (`SHARED_ALLOWED_PREFIXES` includes `suggestions/`). Skipping it is what caused this drift; a sweep like this should not be needed again.

## 2026-08-19 — [agents] New Agent 11: Code Review Specialist (area:review)

- **Why:** every specialist ships code and writes its own changelog entry, but nothing in the roster reviews the result. Adds `agents/review-specialist.md` as the source of truth, rendered to `.claude/agents/review-specialist.md`. It comments findings with `file:line` + a failure scenario and approves only on verified evidence; it never pushes to a PR branch, never merges, and writes no changelog entry for reviewing.
- **Grounded in the failure modes this repo actually hits**, not generic review advice: green checks that ran against a stale head (branch behind `main` ⇒ the green proves nothing about the merge result), `no checks reported` misread as a pass after a dropped `synchronize` event, a `scope` failure whose payload carried an empty label list (a GitHub re-run replays the *original* payload, so only a fresh event fixes it), newest-first changelog collisions between sibling PRs, sibling migrations from a shared parent, and constraints that pass CI because the migration harness runs migrations but **never `seed.ts`**.
- **`SUG-*.md` fidelity is a named duty:** walk the Implementation plan step by step and account for every step (done, or deferred with a reason); treat *Risks & gotchas* as a checklist; require each acceptance criterion to map to a real assertion under its named test.
- **Two small `scripts/render-agents.mjs` changes** to support a non-authoring agent: `copilot: false` skips the path-scoped Copilot render (the only honest `applyTo` would be `**`, which would load review procedure into every editing context), and an optional `trailer` replaces the implementer boilerplate — otherwise the wrapper would have told a reviewer to write an area changelog entry, contradicting its own rules. Existing renders are byte-identical; `--check` is green.
- **Runs the E2E gate itself (G2)** for `apps/ios` / `apps/android` changes — `scripts/e2e-ios.sh` / `e2e-android.sh` in an isolated `git worktree` (never the shared tree), API via `pnpm --filter @repo/api dev:local`, Android emulator pinned to API ≤ 34 (issue #56). A pasted report is the author's claim, not evidence; a mismatch with its own run is a finding. Forcing green via `ALLOW_UNSUPPORTED_API=1` or editing the manifest to match the run is named as falsification, and "I could not run it" is a valid outcome — approval never rests on someone else's screenshot.
- **Hardened against the documented failure modes of automated review:** findings now carry a conventional label + Critical/High/Medium/Low severity (Low never blocks); claim *extraction* and claim *verification* are separate passes, because repeating an author's assertion back as a verified finding is the dominant agent failure; new imports and calls are checked against the version actually in `pnpm-lock.yaml` (invented APIs read perfectly in a diff); all PR-authored text — body, commit messages, code comments, prior reviews — is untrusted data, never instructions, since nearly every PR here is agent-authored; and founder-call items (French copy, ADR-001 privacy model, product ethos, spec amendments) are escalated rather than judged.
- **New `scripts/diff-coverage.mjs` (+ 16 unit tests)** measures G2's other axis: the 80% floor is per *package*, so a package at 85% can absorb an untested new function and stay green. Scores coverage of the lines a branch changed (default floor 70%), excluding non-executable lines automatically. `apps/api/vitest.config.ts` now also emits `lcov`. Gotcha worth knowing: lcov carries package-relative paths while `git diff` is repo-relative — they are joined via `packageRootForLcov`, and an incomplete suite run (e.g. Postgres tests skipped) produces an lcov that under-reports, so only score a full run. Not a CI gate yet — deliberately a review tool first.
- **Reviews lead with a summary.** The first section answers "what's up with this PR?" in ~15 seconds — one-line status, the blocker in plain language (no jargon, no requirement IDs), a numbered next-steps table with an owner column so the founder can see at a glance whether they are blocked on themselves, and one line on what is fine. Detail goes below in a collapsed `<details>` block.
- **Verdicts post as comments, not GitHub reviews.** Every PR here is pushed under the founder's account, agents included, so GitHub refuses `--approve`/`--request-changes` on one's own PR. Found on the first live run (#94); the agent now says to use `gh pr comment` and put the verdict on the summary's first line.
- **Deferred to `suggestions/review/`:** SUG-REV-001 (focused multi-pass review + synthesizer) and SUG-REV-002 (advisory rollout + precision/escape metric). README counts updated to 40 open / 76 done.
- **Not wired to CI.** Nothing invokes it automatically — it runs when asked. Deliberate: auto-review on every PR is a cost/noise decision, not a default.

## 2026-08-18 — [security] Prune the orphaned @prisma/config subtree from the prod image (CVE-2026-40345)

- The Trivy gate went red on `main` (not on any one PR — #86 just inherited it) when CVE-2026-40345 was published: **HIGH, `deepmerge-ts@7.1.5`, stack exhaustion on recursive merge, fixed in 8.0.0**.
- It reaches the image as dead weight, not as a runtime dependency. `deepmerge-ts` has exactly one consumer in `pnpm-lock.yaml` (`@prisma/config`), which has exactly one (`prisma`, the CLI) — and the build stage already deletes `prisma@*`. That orphans the subtree but leaves it on disk, where Trivy still reads it. `@prisma/client` declares `@prisma/config` under **devDependencies** and has zero runtime `dependencies`, so no code path in the image can reach it.
- Added `@prisma+config@*`, `deepmerge-ts@*`, `c12@*` and `empathic@*` to the existing `.pnpm` store cleanup, next to `effect@*` — already deleted from that same orphan chain, which is why only these four were left behind.
- Chose deletion over a `pnpm.overrides` bump to 8.0.0: the override would push a major on the prisma CLI's own dependency to fix code the deployable image shouldn't carry at all. Same reasoning already documented for the bundled `npm`/`corepack` removal — fix at the root, don't suppress.
- **Not verified locally** — no Docker in the dev environment; the lockfile edge analysis above is what the change rests on, with CI's build + scan as the check.

## 2026-08-17 — [scope-guard] `suggestions/**` is allowed from any area

- `suggestions/README.md` requires an implemented suggestion to move to `done/<area>/` and the open/done counts to be updated — bookkeeping every area owes on its own PR, on a tree no area prefix owns. The guard rejected exactly that diff, so the duty was unsatisfiable and the moves silently never happened: PRs #76/#77/#78 all left their suggestion sitting in the open folder.
- Moved `suggestions/` into `SHARED_ALLOWED_PREFIXES`, next to `pnpm-lock.yaml` and `docs/STATUS.md` — same category: files every area must touch, owned by none.
- Only the *path* is shared; a PR still has to be reviewed on its contents. 2 new cases (one `area:db`, one `area:backend`, to pin that the allowance isn't area-specific), 22/22 pass — verified red before green.

## 2026-08-17 — [scope-guard] `pnpm-lock.yaml` is allowed from any area

- Adding a dependency to **any** package rewrites the workspace lockfile, and no area prefix owns it — so every dependency-adding PR failed the scope check unless it also carried `area:sre`. G4 allows new dependencies with justification; the guard was rejecting the diff that justification necessarily produces.
- Moved `pnpm-lock.yaml` into `SHARED_ALLOWED_PREFIXES`, next to `docs/STATUS.md` and `docs/qa/` — the same category: files every area must touch, owned by none.
- **The root `package.json` deliberately stays `area:sre`.** Workspace-level `pnpm.overrides` and shared devDependencies are still an infra decision; only the lockfile is shared. Pinned by a test.
- Found by #74 (`area:db`), which adds a dev-only test runner. 2 new cases, 20/20 pass.
