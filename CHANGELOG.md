# Changelog — repo root (area:devops · docs · agents · design · specs · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, design, specs, scripts, workspace config.
> Per-area history: [apps/ios](apps/ios/CHANGELOG.md) · [apps/android](apps/android/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets, ≤ ~15 lines per entry (G5). Updating the right changelog is part of every Definition of Done.

## 2026-08-08 — [SUG-OPS-012] `ci.yml` hardening: timeouts, main-safe concurrency, `workflow_dispatch`, actionlint, job summary

- `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` — PR branches still cancel superseded
  runs; back-to-back merges to `main` no longer leave the first merge commit with no completed CI.
- `timeout-minutes` added to all four jobs now in the file (`changes: 5`, `ci: 20`, `android-unit: 30`,
  `ios-unit: 30`) — one more job than the plan's estimate of three, since SUG-OPS-001 (landed just
  before this item in the same batch) added the `changes` path-filter job.
- `workflow_dispatch:` trigger added — required for the devops DoD's "tested on a branch
  (`workflow_dispatch` dry-run)" and now exercised by `scope-guard.yml` too.
- `actionlint` step added to the `ci` job (docker-based, zero new third-party action pin — see the
  suggestion's own zero-action alternative) right after checkout, before install.
- Minimal job-summary step (`$GITHUB_STEP_SUMMARY`) at the end of `ci`; cache-hit-rate enrichment is
  SUG-OPS-009's job, not this one's.
- `docs/STATUS.md` not changed here — no module/infra state changed, only CI robustness.

## 2026-08-08 — [SUG-OPS-001] Native iOS/Android unit tests now run in CI

- Added `android-unit` (`ubuntu-latest`, JDK 17 Temurin, `gradle/actions/setup-gradle@v4`,
  `./gradlew test --stacktrace`) and `ios-unit` (`macos-15`, `xcrun swift test`) jobs to `ci.yml`.
  Both verified locally first (`./gradlew test` → BUILD SUCCESSFUL; `xcrun swift test` → 110 tests
  passed) before landing.
- **Deviation from the plan's suggested tooling** (`dorny/paths-filter`): implemented the path filter
  as a plain `changes` job doing its own `git diff --name-only` against the PR base / previous push
  SHA, gating `android-unit`/`ios-unit` via `if: needs.changes.outputs.{android,ios} == 'true'` — no
  new third-party action dependency (G4). Fails open (runs both) on `workflow_dispatch` or when no
  diffable base exists (first push, force-push).
- Explicitly NOT added: emulator/simulator E2E jobs — out of scope per the suggestion; tracked
  separately in `docs/STATUS.md`.
- `docs/STATUS.md` CI row updated.

## 2026-08-08 — [SUG-OPS-013] CI Postgres service + docker-compose on `prisma migrate deploy` (closes #21)

- `ci.yml`: added a `postgres:17` service (fake `swab`/`swab_ci` creds, health-checked), a
  `prisma migrate deploy` step against it, and `DATABASE_URL` on the turbo step. `turbo.json`'s `test`
  task now declares `"env": ["DATABASE_URL"]` so its cache key includes it.
- **Deviation from the original SUG-OPS-013 plan's step 4** (`prisma db push --skip-generate`): the
  baseline migration landed today (SUG-DB-002, `packages/db/prisma/migrations/20260719000000_init`),
  making that step stale before it was ever implemented — used `prisma migrate deploy` instead, per
  explicit instruction. Verified locally against a scratch `postgres:17` container: applies cleanly,
  full `pnpm turbo run lint typecheck test build` green with `DATABASE_URL` set.
- **Folded in GitHub issue #21's other half** (out of data-steward's file scope): `docker-compose.yml`'s
  API command switched from `db push --skip-generate` to `prisma migrate deploy`; documented the
  one-time `prisma migrate resolve --applied 20260719000000_init` step for anyone with an existing
  `db push`-created local database.
- Not implemented here (narrower than issue #21's optional ask): a `prisma migrate diff --exit-code`
  schema-drift check against a shadow database. `migrate deploy` fails if the migration set can't
  apply, but won't catch a `schema.prisma` edit that has no matching migration file — left as a
  possible stronger follow-up, not requested in this batch's instructions.
- Filed #22 (area:api, backend-specialist): `prisma-repo.ts` integration tests against this new
  Postgres service — this PR only adds capacity, zero integration tests included.

## 2026-08-08 — [SUG-OPS-010] Node version single source of truth (`.nvmrc`, 20 → 22)

- Added `.nvmrc` (`22.23.2`, current 22.x LTS "Jod" point release) at repo root. `ci.yml`'s
  `setup-node` step now reads `node-version-file: .nvmrc` instead of a hardcoded `20`. Root
  `package.json` `engines.node` tightened `>=20` → `>=22` to match reality.
- Closes the drift: `apps/api/Dockerfile` (`node:22-slim`) was already 22; CI was silently testing on
  20. `pnpm turbo run lint typecheck test build` verified green locally (all 10 tasks) before landing
  — no code changes needed for the bump.
- Grepped for other hardcoded Node majors (`README.md`, `DEVELOPMENT.md`, workflows): none found
  outside the two now-aligned sources (`.nvmrc`, Dockerfile).
- Gotcha for future dependency bumps: `.nvmrc` and the Dockerfile base image move together — bump
  both in the same PR, per the original suggestion's note (Renovate/Dependabot won't sync them).

## 2026-08-08 — [SUG-OPS-002] CODEOWNERS + scope-guard check (G4 enforcement, not yet required)

- Added `.github/CODEOWNERS` (review-routing only — solo repo, `@hamza-el-miqdam` everywhere) and
  `.github/workflows/scope-guard.yml`, which runs `scripts/scope-guard.mjs` on every PR: unions the
  allowed path prefixes of the PR's `area:*` label(s) (derived from each `agents/*-specialist.md`
  Scope section) and fails if the diff escapes them. Hard gate: `packages/db/prisma/schema.prisma`
  touched without `area:db` always fails, independent of other matches.
- `scripts/scope-guard.mjs` exports a pure `computeViolations(labels, changedFiles)`, table-driven
  tested in `scripts/scope-guard.test.mjs` (15 cases, `node --test` — no new dependency) and run as a
  step inside `scope-guard.yml` itself.
- Deviation from the plan draft: accepts both label spellings the repo actually uses for the same
  area (`area:api`/`area:backend`, `area:sre`/`area:devops`) rather than picking one — verified by
  grep, the repo itself is inconsistent.
- Known gap, not covered: `agents/*.md` and top-level governance docs (`docs/product-overview.md`,
  `swab-domain-spec.md`, …) aren't owned by any single agent's Scope section, so they're absent from
  the mapping — left alone rather than guessed.
- PRs without a recognized `area:*` label warn-and-pass (not required in branch protection yet, per
  plan step 5 — flip once green on a few real PRs). `docs/STATUS.md` CI row updated.

## 2026-08-08 — [SUG-DES-003] wire the token drift guard into `packages/ui`'s `test` script

- `packages/ui/package.json`: added `test` (= `node scripts/generate.mjs --check`) and `generate:check`
  (same command, explicit name) scripts. `pnpm turbo run test` already runs every workspace's `test`
  task, so this closes the gap where hand-edited `DesignTokens.swift`/`.kt`/`tokens.ts`/`tokens.css` or
  an un-regenerated `tokens.json` change could land without CI ever exercising `--check`.
- Verified locally: `pnpm --filter @repo/ui test` → "Design tokens up to date."; hand-touched
  `packages/ui/src/tokens.css` (flipped `--color-nuit`) → re-ran → `STALE: packages/ui/src/tokens.css`
  + exit 1; reverted the hand-touch, re-ran → passes again.
- `docs/design-system.md` §5: noted the `--check` guard now runs via the package's `test` script.
- Scope note: `.github/workflows/ci.yml` is untouched here (out of design-specialist scope) — a named
  CI step for a clearer failure message is tracked separately as SUG-OPS-006 (devops-specialist).

## 2026-08-08 — [ONB-04, MAP-01, FCH-01, FCH-04, ENV-03, ENV-04, ENV-13, ENV-14, ENV-17, ENV-18, ENV-19] sync FS-01/FS-02/FS-03/FS-05 French Notion mirrors after today's direct-to-main spec commits

- Mandatory version check (`.notion-sync.json` snapshots vs live Notion fetch + comments) found all
  four pages untouched since last sync — no co-founder edits, no unresolved comments — so every spec
  was the code-only case, not a conflict. Confirmed by content diff, not by trusting the task framing.
- Pushed French translations for: FS-01 ONB-04 + new OQ-ONB-1 (SUG-SPEC-009); FS-02 MAP-01
  cross-reference; FS-03 FCH-01 cross-reference + FCH-04 ENV-19 citation (SUG-SPEC-008/009); FS-05
  ENV-17/ENV-18 (new rows) + OQ-ENV-3, amended ENV-13/ENV-14 + new ENV-19 row, OQ-ENV-4/OQ-ENV-5
  (SUG-SPEC-006/008/012).
- Also caught and synced an **already-merged but never-pushed** delta on FS-05: PR #18
  (`c615be7`/`8ce324f`, SUG-SPEC-004, merged today before the four direct commits) had reworded
  ENV-03/ENV-04 on disk for the L1-veto-visibility fix, but the Notion page still showed the old
  wording — the previous three sync-flagged commits since 08-04 were never actually synced. Pushed
  that translation too so `lastSyncedFrench` now matches live Notion exactly, not just today's batch.
- Requirement IDs, code identifiers, file paths, and already-frozen French UI quotes carried verbatim
  in both directions per role rules; "source canonique" note left untouched on all four pages.
- `.notion-sync.json`: `lastSyncedAt`/`lastSyncedEnglish`/`lastSyncedFrench` updated for FS-01, FS-02,
  FS-03, FS-05 only. No `docs/STATUS.md` change — this sync resolves no open question and changes no
  spec's implementation-readiness.

## 2026-08-08 — [ONB-04, MAP-01, FCH-01] pin the intimacy ring enumeration to an open question, not an invented value

- `docs/specs/FS-01-onboarding.md`: ONB-04 no longer leaves the ring count/labels unstated (SUG-SPEC-009).
  Investigated the Onboarding blueprint (`blueprints/swab - Onboarding (standalone) (1).html`, `INTIMACY`
  constant) against both shipped apps before writing anything: the blueprint defines **5** rings
  (`intime`/`proche`/`ami`/`lien faible`/`connaissance`), but both native apps consistently ship **4**
  rings with entirely different labels (`Très proche`/`Proche`/`Familier`/`Plus loin` — identical between
  `apps/ios/Sources/SwabCore/L10n/Fr.swift` and `apps/android/.../l10n/Fr.kt`). iOS and Android agree
  with each other, so this is a blueprint-vs-shipped divergence, not a cross-platform bug. Recorded as
  **OQ-ONB-1** (blocking) rather than freezing either side unilaterally — spec standard #3 forbids
  inventing French copy from app code, and the shipped 4-ring model is too load-bearing (QA manifest,
  E2E suites, the known rings-3/4 `CalibrateScreen` text-wrap bug) to silently overwrite with the
  blueprint's 5-ring set.
- `docs/specs/FS-02-relationship-map.md` (MAP-01) and `docs/specs/FS-03-contact-card.md` (FCH-01) now
  cross-reference "ring enumeration per ONB-04 (currently OQ-ONB-1)" instead of duplicating it.
- Follow-up: product must pick a canonical ring model (update blueprint, retrofit both apps, or re-freeze
  shipped labels) before FS-04's SGR-01 shared enumeration / SUG-SPEC-005 test vectors can be written.
- notion-liaison-specialist: FS-01/FS-02/FS-03 mirror needs a sync pass (not done here).

## 2026-08-08 — [ENV-13, ENV-14] resolve "exactly three actions" vs accept/decline contradiction; require non-empty proposals

- `docs/specs/FS-05-envie-match.md`: ENV-13 is now state-dependent — an OPEN match with no pending
  incoming proposal offers exactly Proposer un lieu / Proposer une heure / Passer cette fois; an OPEN
  match with a pending incoming proposal instead offers accept/decline/pass. ENV-14 gained "a proposal
  MUST carry at least one of {place, timeslot}; the API rejects an empty proposal (422)" — closes the
  empty-proposal gap in the seam contract.
- Two things are flagged, not guessed: accept/decline French copy does not exist in any blueprint or
  spec (verified — zero matches in the "Flux envie et match" blueprint or product-overview.md), routed
  through the missing-copy protocol (playbook §4 rule 5) as **OQ-ENV-4**; whether Passer cette fois
  stays available while a proposal is pending is a genuine product question, marked
  ⚠️ PROPOSED ASSUMPTION (assumed yes) as **OQ-ENV-5**. Both filed as `question` issues (#19, #20)
  owned by the Architect per playbook §7.
- `specs/001-envie-match/spec.md` re-synced: US3 acceptance scenario 1 split per-state, new scenario
  for empty-proposal rejection, FR-013/FR-014 updated, Assumptions bullet added.
- No `docs/STATUS.md` change — FS-05 stays "Not started" (spec-text-only amendment).
- Per SUG-SPEC-012. French Notion mirror needs a sync pass for FS-05 (notion-liaison-specialist, not
  done here).

## 2026-08-08 — [ENV-19, FCH-04] specify the vault path for FCH-04's "match events" history entries

- `docs/specs/FS-05-envie-match.md`: added ENV-19 to the Post-match table — on receiving a match
  notification, the client appends a coarse-grain relationship event to the local vault history for
  the matched contact. Grain proposed as `{date, category}` only, never the verb — flagged
  `⚠️ PROPOSED ASSUMPTION`, pending Hamza's sign-off (playbook §7), NOT added to
  `docs/product-overview.md` §6 here. Server keeps no per-relation history beyond the `Match` row.
- `docs/specs/FS-03-contact-card.md` FCH-04: appended a citation to ENV-19 as the producing
  requirement, noting the match-events clause stays deferred until FS-05 lands. Closes the
  traceability gap where FCH-04 required vault-sourced match events but no requirement wrote them.
- No `docs/qa/e2e-coverage.json` change — the existing "not yet testable, FS-05 not implemented"
  note is still honest. No `docs/STATUS.md` change — FS-05 stays "Not started", FS-03 stays
  "Implemented"; this is a spec-text-only addition.
- Per SUG-SPEC-008. French Notion mirror needs a sync pass for FS-03/FS-05 (notion-liaison-specialist,
  not done here).

## 2026-08-08 — [ENV-17, ENV-18, OQ-ENV-3] add server-side validation requirements for `POST /envies`

- `docs/specs/FS-05-envie-match.md`: added ENV-17 (server validates `verb` length, `category`
  taxonomy membership, `recipientIds` non-empty/distinct/author-excluded/existing-users/count-capped,
  `expiresAt` window-capped — `422` + no partial creation on violation) and ENV-18
  (`idempotencyKey` unique per author; retry returns the original envie, `200`, never a duplicate,
  a recomputed match, or a second outbox notification — explicitly ties into ENV-09/ENV-10).
  Every field in the `POST /envies` contract line now traces to at least one requirement ID.
- Added OQ-ENV-3 (Open questions): whether `recipientIds ⊆ author's ContactLink targets` is
  enforced — a genuine privacy trade-off either way, left for the Architect, not decided here.
- Two ⚠️ PROPOSED ASSUMPTION values inside ENV-17 (`recipientIds` cap N=150 / MAP-07 circle bound;
  `expiresAt` cap 48h) are flagged, NOT yet added to `docs/product-overview.md` §6 — per playbook
  §7 they need Hamza's sign-off first.
- `specs/001-envie-match/spec.md` re-synced: FR-017/FR-018 added with (ENV-17)/(ENV-18) tags, plus
  an Assumptions bullet noting the same two proposed caps and the OQ-ENV-3 non-decision.
- Per SUG-SPEC-006. French Notion mirror needs a sync pass (notion-liaison-specialist, not done here).

## 2026-08-08 — [ENV-03, ENV-04, FLT-02] resolve L1 veto visibility contradiction between spec-kit artifact, FS-05, and FS-06

- `specs/001-envie-match/spec.md` (US1 scenario 3, FR-004) and `docs/specs/FS-05-envie-match.md`
  (ENV-03, ENV-04) both used wording ("never shows an override control" / "never appears as
  revocable") that implied an L1-vetoed contact is rendered in the pre-send review minus a button
  — contradicting FS-06's authoritative acceptance criterion (`FS-06:33`): an L1-vetoed contact
  "appears nowhere in the review UI", confirmed by the property test
  `included ∪ filtered ∪ (L1-vetoed) = scope members` (a disjoint third set).
- Reworded all four sites to say consistently: an L1 veto-absolu exclusion does not appear in
  either the Included or Filtered list, no override control anywhere (FLT-02).
- Documentation-consistency fix only — no product/UX decision invented; FS-06 itself needed no
  change and was left untouched. `specs/001-envie-match/checklists/requirements.md` has no
  veto/L1 mentions; no `plan.md`/`tasks.md` exist yet for `001-envie-match` to patch.
- Per SUG-SPEC-004. FS-05 wording changed — French Notion mirror needs a sync pass
  (notion-liaison-specialist, not done here).

## 2026-08-04 — [OQ-FCH-1, OQ-FCH-2, FCH-05] sync FS-03 Open questions to French Notion mirror; merge an unrelated FCH-05 drift found in the process

- Mandatory check found the Notion side untouched for Open questions (still only the old
  pre-implementation OQ-FCH-1) while `docs/specs/FS-03-contact-card.md` (branch
  `spec/fs03-taxonomy-oqs-unresolved`, SUG-SPEC-007) had reworded OQ-FCH-1 and added OQ-FCH-2 —
  code-changed-only case. Translated both into French and pushed to the Notion page's
  "Questions ouvertes" section (issues #15, #16 stay the Architect's to resolve; not touched here).
- Also found FCH-06's neighbor, FCH-05, had drifted the other way: Notion's French text had been
  edited directly ("période configurable" → "période fixe ; réglage utilisateur hors périmètre —
  à revisiter seulement si des testeurs le demandent") with no corresponding English change on
  disk. Not a structural edit (no ID touched, no requirement invented/reversed), so merged the
  clarification back into the English FCH-05 row per the liaison's routine "Notion changed only"
  case, rather than treating it as a conflict.
- No comments/discussions were pending on the FS-03 page.
- `docs/specs/.notion-sync.json` FS-03 snapshots (English + French) and `lastSyncedAt` updated to
  match; disk English snapshot verified byte-identical to `docs/specs/FS-03-contact-card.md`.

## 2026-08-04 — [OQ-FCH-1, OQ-FCH-2, FCH-06, FLT-01] promote FS-03 taxonomy gaps to tracked open questions

- OQ-FCH-1 (`docs/specs/FS-03-contact-card.md`) still described a pre-implementation world
  ("Architect to extract with Hamza before implementation") even though FS-03 shipped 2026-07-10
  (`docs/STATUS.md`) with placeholder Rôles·contexte / Ressenti vocabularies. Reworded to state
  it's still open post-implementation and that changing the vocabulary later is a vault-content
  migration (existing user tags must map forward) — resolve before external testers.
- Added OQ-FCH-2: the état-vs-ressenti axis ambiguity for « en pause », previously only flagged
  in QA notes (`docs/qa/e2e-coverage.json` FCH-06), was never promoted to a spec-level OQ despite
  playbook §7 requiring every OQ-* to be spec-tracked. Spec's position is état (FCH-06, FLT-01);
  audit both native apps before FS-06 implementation starts.
- Filed GitHub issues #15 (OQ-FCH-1) and #16 (OQ-FCH-2), both `question`-labeled, owned by the
  Architect — neither resolved here (G4: don't guess product behavior).
- Per SUG-SPEC-007. Notion mirror re-sync for FS-03's Open questions section still needed
  (notion-liaison-specialist).

## 2026-08-04 — [IDT-02, IDT-03, IDT-04, IDT-06, IDT-07] fix coverage classes overstating apps/api test existence

- `docs/qa/e2e-coverage.json` + `docs/qa/e2e-scenarios.md` (FS-07 section) claimed `api-integration`
  verification (or notes asserting apps/api tests) for behavior with no endpoint and no test:
  IDT-02 (refresh rotation/reuse — no `/auth/refresh` route exists), IDT-07 (invite links/web
  landing — no routes, no `apps/web`). Both reclassed to `not-e2e-verifiable` with notes pointing
  to the FS-07 gap and a reclass-when-implemented instruction.
- IDT-03 (per-IP throttle half untested), IDT-04 (deletion endpoint/test both missing), IDT-06
  (discovery endpoint missing) kept their existing class but had notes corrected to stop claiming
  tests/endpoints that don't exist yet, per grep of `apps/api/src/routes/` and `apps/api/tests/`.
- G2 requires honest classification, never silently dropped; these read as verified when they
  weren't. `automated` entries untouched (drift guard depends on them). Verified via
  `node scripts/e2e-report.mjs --android <existing device run>`: overall PASS, 0 drift failures.
- Per SUG-SPEC-001. Gotcha for future agent: when FS-07 backend session/deletion/discovery/invite
  work lands, reclass these entries back to `api-integration` in that same PR (notes say so).

## 2026-07-21 — [ONB-02, FCH-05, ENV-15] Notion mirror sync for SUG-SPEC-013 wording-precision fixes

- Follow-up to the SUG-SPEC-013 commit (6a65f64): pushed the three French Notion mirror pages
  (FS-01, FS-03, FS-05) to match the English spec edits.
- Pre-sync check: `.notion-sync.json` snapshots, live Notion content, and comments for all three
  pages all matched the pre-fix state exactly — no drift, no unresolved comments, no conflict.
  Code-changed-only case; translated and pushed directly.
- ONB-02: `IDT-01…04` → `IDT-01…03` in the French table row.
- FCH-05: "période configurable (par défaut 6 mois ⚠️ HYPOTHÈSE)" → "période fixe (6 mois
  ⚠️ HYPOTHÈSE ; un réglage visible par l'utilisateur est délibérément hors périmètre — à revisiter
  seulement si des testeurs le demandent)".
- ENV-15 acceptance criterion: "(modulo les timestamps)" → explicit bound naming server-clock
  metadata as the only permitted difference, no entity field (incl. `updatedAt`-style) may change.
- `.notion-sync.json` snapshots refreshed for FS-01/FS-03/FS-05 (English + French + lastSyncedAt).

## 2026-07-21 — [ONB-02, FCH-05, ENV-15] wording-precision fixes: IDT range, "configurable", "modulo timestamps"

- ONB-02 cited `IDT-01…04`; IDT-04 is account deletion (FS-07:16), unrelated to signup. Narrowed to
  `IDT-01…03` (the actual signup/session/throttle set) so an IDT-04 traceability grep no longer
  falsely pulls in onboarding.
- FCH-05 called the 6-month staleness period "configurable" with no configurer anywhere in FS-03 or
  FS-06's settings surface. Verified neither native app ships a staleness setting — both hardcode
  the constant (`apps/ios/Sources/SwabCore/Fiche/FicheStaleness.swift:9`,
  `apps/android/.../fiche/FicheStaleness.kt`), no `SettingsScreen`/`SettingsView` exists on either
  platform. Reworded to "fixed period ... a user-facing setting is deliberately out of scope —
  revisit only if testers ask." The 6-month value itself remains ⚠️ ASSUMPTION.
- ENV-15's acceptance criterion said responses must be "byte-equivalent (modulo timestamps)" with
  no list of which timestamp fields are exempt — an exemption list a test can't pin could silently
  grow to hide a real leak (e.g. an `updatedAt` ticking on pass). Replaced with an explicit bound:
  only server-clock response metadata may differ; no entity field (incl. `updatedAt`-style columns)
  may change on the counterpart's side because of a pass. Mirrored in `specs/001-envie-match/spec.md`
  (US3 scenario 3, FR-015). FS-05's requirement row (line 43, plain "bit-identical") was left as-is —
  still consistent, not touched by this fix.
- Per SUG-SPEC-013. Gotcha for backend/data agents: this constrains the future Match schema — no
  auto-touched `updatedAt` may leak on the counterpart's side. Notion re-sync for the FS-01/FS-03/
  FS-05 sentences is a follow-up (not done here — notion-liaison-specialist owns translation).

## 2026-07-21 — [ENV-07, OQ-ENV-2] resolve decided-vs-open contradiction on envie expiry semantics

- `specs/001-envie-match/spec.md`'s Assumptions section stated OQ-ENV-2 (24h vs same-day-midnight
  expiry) was "considered and rejected" — a resolution that never happened. FS-05 still lists it
  open (`docs/specs/FS-05-envie-match.md:60`) and the checklist still says "pending final
  product-owner sign-off" (`specs/001-envie-match/checklists/requirements.md:36`); no PO decision
  is recorded anywhere (verified via `git log --all --grep` and `gh issue list`, both empty).
- Reworded the bullet to state the 24h rolling window as FS-05's buildable default (ENV-07 ⚠️
  ASSUMPTION) while explicitly keeping OQ-ENV-2 open with the product owner, and to call for an
  expiry-policy seam so a later switch to same-day-midnight isn't a rewrite (playbook §4 rule 6).
  FS-05 itself needed no change — its open-question state was already correct.
- Per SUG-SPEC-011. Playbook §7: agents never resolve OQs implicitly.

## 2026-07-20 — [SUG-SPEC-010] sync French Notion mirror for FS-01..07 "iOS + Android" agent headers

- Notion-liaison pass on all 7 FS-* pages: fetched live content + comments (zero pending edits/
  discussions found on any page — no conflicts, clean "code changed only" case throughout).
  Translated "Mobile" → "iOS + Android" in the **Agents :** line of FS-01, FS-02, FS-03, FS-05,
  FS-06, FS-07 (FS-04 too, same fix). "iOS + Android" kept as-is per SUG-SPEC-010.
- Also caught and fixed pre-existing unsynced drift the mandatory full-snapshot diff surfaced:
  FS-01/02/03 **Statut** headers were still "Approuvé" on Notion although disk had carried
  "Implémenté (Vague 1/2/3, 2026-07-10)" since the Wave 1-3 landings — never synced. And the
  stale Expo/RN wording fix (previous entry, SUG-SPEC-005) for FS-02 non-functional, FS-04
  non-functional, FS-06 FLT-06, FS-07 VLT-01 had likewise never reached the French mirror.
  All translated and pushed in this pass.
- `docs/specs/.notion-sync.json`: `lastSyncedEnglish`/`lastSyncedFrench` snapshots refreshed to
  exact disk/Notion content for all 7 specs, `lastSyncedAt` → 2026-07-20.
- Gotcha: one Notion `update_content` call with 2 batched edits silently applied only the first
  (no error) — always re-fetch and verify after multi-edit batches, don't trust a bare success.

## 2026-07-20 — retire "Mobile" agent references from playbook and all FS specs

- `docs/agent-playbook.md`: ownership matrix (§1) and build order (§2) replaced every "Mobile" cell/line
  with "iOS + Android". Added clarifying sentence: "'iOS + Android' means the same requirement is
  implemented per-platform by ios-specialist and android-specialist, each gated by its own E2E suite."
  Also fixed: line 57 "The SRE agent" → "The DevOps agent (area:sre)" and line 22 "Neon GC" reference.
- All spec headers FS-01..07 replaced "Mobile" with "iOS + Android" in their Agents line (e.g.
  FS-01: "iOS + Android (lead)" instead of "Mobile (lead)", FS-07: "iOS + Android (vault client)"
  instead of "Mobile (vault client)").
- Mobile-specialist (Expo RN) decommissioned 2026-07-09; work now split to ios-specialist + android-specialist.
  Reference: `docs/migration/rn-native-handoff.md`, SUG-SPEC-010.
- Notion mirror re-sync needed for French translation of "iOS + Android" — pending notion-liaison pass.

## 2026-07-20 — [VLT-01, FLT-06, SGR-01] retire stale Expo/RN wording from normative spec text

- FS-07 (VLT-01), FS-06 (FLT-06), FS-04 (non-functional), FS-02 (non-functional) still named the
  retired Expo RN app and dead `apps/mobile` paths (removed 2026-07-19) — fixed per SUG-SPEC-005.
- VLT-01 now says the vault key lives in "the platform secure store (iOS Keychain via CryptoKit /
  Android Keystore)", matching `docs/STATUS.md:15` and the ios/android changelogs. FLT-06 and the
  FS-04 non-functional section now describe evaluation/FCA as a pure, UI-framework-free domain
  module per platform (`apps/ios` Swift / `apps/android` Kotlin), behavior-locked by shared
  cross-platform test vectors (pattern: `docs/migration/vault-test-vectors.json`) rather than one
  `apps/mobile/src/domain/*.ts` file. FS-02's non-functional section drops
  `react-native-reanimated` for platform-native GPU/UI-thread animation guidance.
- No requirement semantics changed: FLT-06's `applyFilters` contract, SGR-01 determinism, VLT-01's
  AES-256-GCM + recovery-phrase assumption, and FS-02 perf budgets are word-for-word preserved.
- Gotcha: `docs/specs/.notion-sync.json` (Notion mirror cache) still has the old English text —
  intentionally not hand-edited here; needs an actual notion-liaison-specialist sync pass.

## 2026-07-20 — [none] resync .specify/memory/constitution.md against agents/_global-directives.md

- Ran `/speckit-constitution` to fix drift called out in SUG-SPEC-003: Principle V's changelog area list
  still named the retired `apps/mobile/CHANGELOG.md` (area:mobile) and was missing `apps/ios`/`apps/android`
  and design/specs in the root list; Principle II was missing the mobile E2E Definition-of-Done gate
  (`docs/qa/e2e-scenarios.md`, `e2e-coverage.json`, `scripts/e2e-{ios,android}.sh` PASS + zero drift).
- Also carried over the "≤15-line changelog summary" rule and "flip spec Status: header to Implemented"
  detail, and resolved the standing `TODO(RATIFICATION_DATE)` — set to 2026-07-04 (first commit touching
  `agents/_global-directives.md`). Version bumped 1.0.0 → 1.1.0 (MINOR: principles expanded, none removed).
- No constitution-only substance introduced; Additional Constraints / Development Workflow sections
  untouched — governance rule is the source-of-truth directives file always wins.

## 2026-07-19 — [area:design] packages/ui: canonical design-token SSOT + codegen for iOS/Android/web

- New `packages/ui/tokens/tokens.json` — single hand-edited export of the Nuit token set (color, typography,
  spacing, radius, component), pulled verbatim from Penpot's "Nuit" token set, cross-checked clean against
  `docs/design-system.md`. New `packages/ui/scripts/generate.mjs` (styled after `scripts/render-agents.mjs`,
  same `--check` drift gate) renders it to `packages/ui/src/tokens.{ts,css}`,
  `apps/ios/Sources/SwabCore/Generated/DesignTokens.swift`, and
  `apps/android/.../ui/theme/DesignTokens.kt` — banner-commented, never hand-edited. `@repo/ui` registered
  (mirrors `packages/db`'s shape); Swift type-checked, Kotlin compiled, TS lint/typecheck all clean.
- `agents/design-specialist.md` Scope gained "Design reference ownership": `tokens.json` + the generator are
  the one exception to "never edit apps/ios/apps/android" (generated output only); `render-agents.mjs` re-run.
- Updated `docs/design-system.md` §5 and `docs/STATUS.md` for the real chain; wiring tokens into the actual
  iOS/Android theme code is left to `area:ios`/`area:android`.
- **Gotchas:** Kotlin has no implicit Int→Double conversion for literal args (Swift does) — caught by
  actually compiling, not just parsing. `packages/ui/eslint.config.mjs` composes the root config + adds Node
  globals for `scripts/**`, since (unlike root-level scripts, which no turbo package lints) this one is.

## 2026-07-19 — Agents review: spec-specialist added, stale references fixed, changelogs/STATUS compacted

- New `agents/spec-specialist.md` (area:specs) — owns `docs/specs/FS-*.md` authoring (stable requirement IDs, testable acceptance criteria, frozen French copy, OQ-* open questions) and the spec-kit pipeline (`specs/**`, `/speckit-*`, constitution resync). Registered in `scripts/render-agents.mjs`; renders to `.github/instructions/specs.instructions.md` + `.claude/agents/spec-specialist.md`. Notion translation stays with the notion-liaison (boundary stated in both files). New Claude Code subagents need a session restart.
- G5 gained a hard conciseness rule: changelog entries ≤ ~15 lines; investigation diaries and per-requirement tables belong in PRs/docs, not changelogs.
- Stale-reference cleanup after the `apps/mobile` removal: `CLAUDE.md` (project description, commands, changelog list), `agents/_global-directives.md`, backend-specialist scope (`apps/mobile` → `apps/ios`/`apps/android`), design-specialist DoD (`area:mobile` → `area:ios`/`area:android`), and "G4.7" citations corrected to G5 in the api/db/root changelog headers.
- Compacted the bloated history files: `docs/STATUS.md` (99→~60 lines, migration banner summarized), root/ios/android changelogs rewritten as summaries (root also had a leftover merge-conflict marker and out-of-order entries — fixed). No facts dropped, only narration; deep detail remains in git history and `docs/migration/rn-audit-map.md`.
- **Follow-up:** re-run `/speckit-constitution` to mirror the amended G5 into `.specify/memory/constitution.md`.
- `ci.yml` now runs `node scripts/render-agents.mjs --check` — the `.github/` Copilot copies are deliberate generated duplication (Copilot can't follow imports, unlike the `.claude/agents/` `@`-import wrappers); the CI guard is what makes keeping them safe.

## 2026-07-20 — [IDT-02, IDT-04, IDT-06, IDT-07, IDT-09] Sync FS-07 Status header to Notion French mirror

- Re-checked the FS-07 Notion page (and comments) before syncing per the liaison workflow: no
  independent edits, no unresolved comments — content matched `lastSyncedFrench` exactly, so this
  was a clean "code changed only" push, not a conflict.
- Translated the corrected `**Status:**` header (SUG-SPEC-002, commit 6fc1161, branch
  `spec/fs07-status-header-drift`) into French and pushed it to the Notion page via a targeted
  `update_content` replace — no other page content touched.
- Updated `docs/specs/.notion-sync.json` (`lastSyncedEnglish`, `lastSyncedFrench`, `lastSyncedAt`)
  for FS-07 so the next liaison run doesn't re-flag this as a pending diff.

## 2026-07-20 — [IDT-02, IDT-04, IDT-06, IDT-07, IDT-09] Fix FS-07 Status header drift

- `docs/specs/FS-07-identity-vault.md`'s header claimed full "Implemented" while `docs/STATUS.md`
  already showed FS-07 as 🟡 In progress and `apps/api/src/routes/` has no refresh, deletion, or
  discovery endpoints — spec and status disagreed on the same module's completeness.
- Corrected the header to "In progress", enumerating the same four pending items STATUS.md already
  listed: refresh rotation/reuse detection (IDT-02), account deletion (IDT-04), contact discovery
  (IDT-06), invite links + web landing (IDT-07/09).
- Extended STATUS.md's FS-07 row "Missing:" list to name all four items explicitly (previously only
  named two), so the row and the spec header now enumerate identical pending work.
- No code changed; docs-only drift fix (`area:specs`).

## 2026-07-19 — chore: remove frozen apps/mobile RN reference implementation

- Deleted `apps/mobile` (Expo/RN reference) — native `apps/ios` + `apps/android` reached parity (Waves 1–4). Knowledge preserved in `docs/migration/rn-native-handoff.md`, `vault-test-vectors.json`, `rn-audit-map.md`.
- Updated `agents/_global-directives.md`, `agents/{design,ios,android}-specialist.md`, `docs/STATUS.md`, and this file's per-area links to drop `apps/mobile`.

## 2026-07-17 — [area:design] Penpot native Flows wired — prototype is now Play/Present-able

- Play mode reads `page.flows`, not click wiring: repointed the 5 existing Flows from wrapper boards to real 418×890 screens, created `"0 · Parcours complet"` (entry at `1 · Bienvenue`, previously missing) and 10 Flows for orphan/variant-cluster roots — 16 Flows total, each verified to start on a genuine phone screen.
- Fixed 3 stale click-wiring bugs: OTP screen now lands on `6 · Bon retour`; `23 · Envies de recevoir` rows repointed from a cross-flow copy-paste artifact to `24 · Offrir · pioche scellée`; `24`'s button now completes the Générosité flow at `25 · Réception`. BFS from Bienvenue: 25→26 screens (the intended +1), orphan alternates stayed separate.
- **Gotchas:** a page can be fully click-wired yet unplayable if no Flow targets a real screen — audit both. `flow.startingBoard` is directly assignable; interactions must be `.remove()`d and recreated via `addInteraction` to change destination.

## 2026-07-17 — [area:design] Penpot prototype click-walkability pass — 7 interactions wired

- Page holds 33 screens / 9 flows (STATUS's stale 22/7 corrected). Wired 7 `click → navigate-to` interactions against the blueprint's `show()` graph (carte-foyer CTA, Générosité forward path, budget gift rows, frôlement → accordage); verified by reading destinations back.
- Confirmed ~15 buttons correctly left unwired (local UI state / silent-decline pattern — calm by design, no forced nav). Left `12 ter`'s "Confirmer samedi 11h" unwired — no defensible destination; needs the user's call.
- **Gotcha:** interaction count read back 59 vs expected 57 — page may have been edited live concurrently; noted, not chased.

## 2026-07-12 — [area:design] Split "Mariages & naissances" into two rows on Paramètres

- `22 · Paramètres`: one event row became two independent toggles ("Mariages", "Naissances") — distinct life events, mutable separately. Applied in sync to the Penpot board, `docs/design/swab-prototype-consolidated.html`, and `blueprints/swab-app-prototype.html`; cloned the existing switchrow so styles/defaults are identical; zero overflow re-verified.
- **Gotcha:** `shape.clone()` inserts at an unpredictable sibling index and flex reflow is async — re-read child order, fix with `setParentIndex`, `await` ~300ms before reading positions.

## 2026-07-12 — [area:design] Flow 0 follow-up: simplified Bienvenue, new optional "Vos coordonnées" screen

- `1 · Bienvenue`: removed the fabricated cohort-info block (no such data exists pre-auth — product law 5), replaced with a calm welcome; CTA renamed "Commencer", destination unchanged.
- New `5 · Vos coordonnées` (between `4 · Votre nom` and the renumbered `6 · Bon retour`): optional Adresse + Email fields reusing the Text field component; single always-enabled "Continuer" (optional layers never block, per ONB-03/06 precedent). Both HTML prototype sources kept byte-identical.
- **Unspec'd, flagged not frozen:** neither field exists in any spec; copy is proposed. Introduces two candidate `User` fields (postal address, email) — **needs an `area:db` proposal** (storage/encryption story undecided; address is sensitive PII though not classification data).
- **Gotchas:** `insertChild` silently no-ops on an existing child — use `setParentIndex`; nudge a flex property to force reflow after inserting into a flex row; screen titles live in BOTH the board name and the topbar text — renumber both.

## 2026-07-12 — [area:design] Penpot prototype restructured into workflow-grouped flows + interactions

- "Prototype — Parcours consolidé": 22 flat screen boards reorganized into 7 named `Flow N · <Title>` flex boards (Onboarding, Carte, Sous-groupes, Envie & Match, Événements, Notifications, Paramètres), stacked with clear breathing room; 32 `click → NavigateTo` interactions wired on the actual tappable elements. Deliberately NOT wired (logged, not guessed): loops, refusal paths (calm-by-design), and screens with no confirmation target; Paramètres has no back-to-Carte affordance — flagged as a UX gap.
- Consistency: 17 segmented-control cells relinked from hardcoded radius 8 to the `radius.input` token (10). `applyToken()` on component *main instances* silently fails to persist — logged as incomplete polish (values already correct).
- **Flagged, not fixed:** 39 recurring micro-spacing values (1/6/10/13px) in compound components — intentional-looking sub-scale spacing, needs a documented scale extension or a normalization pass (follow-up).
- No blueprint/content changes — canvas organization and interactions only.

## 2026-07-12 — [ONB-01, ONB-02, IDT-01..03] New phone+OTP auth flow (sign-up/sign-in), design-only

- The prototype jumped from Bienvenue straight to key generation despite auth being fully built server-side. New `Flow 0 · Authentification` (5 screens): phone entry → 6-box OTP (error state in `corail`) → name (new account) / `Bon retour` (returning) — one shared entry diverging only after verification, mirroring `POST /auth/otp/verify`. Mirrored into both HTML prototype sources; **Text field** and **OTP input** components added to `docs/design-system.md`.
- OTP screen's branch to "Bon retour" is documented, not wired (one destination per trigger); Flow 1 renumbered locally.
- **Incomplete, flagged:** the two new components aren't placed on the Design System page yet (Penpot only writes to the browser-active page — follow-up). New-device sign-in (lost vault key) deliberately not designed — blocked on the recovery-phrase flow (OQ-IDT-2).

## 2026-07-12 — Wave 4: mobile E2E testing made a hard Definition-of-Done gate

- Every implemented requirement (FS-01/02/03/07, ~40 IDs) now has a scenario in `docs/qa/e2e-scenarios.md` + a verification class in `docs/qa/e2e-coverage.json`. New `scripts/e2e-report.mjs` (zero new deps) joins on-device results to the manifest → `test-results/e2e/e2e-report.{md,json}` with a **drift guard** (an `automated` requirement with no executed test fails the run). One-command gates: `scripts/e2e-{android,ios}.sh`.
- G2 + both mobile specialists' DoD now require the full platform suite green (report PASS, zero drift, summary pasted in the PR) before Done; `docs/agent-playbook.md` updated; renders regenerated.
- Suites landed and independently re-verified from clean by the lead: Android 16/16, iOS 13/13. The iOS run exposed a real bug — code signing fully disabled since Wave 1 broke Keychain entitlements under XCUITest; fixed with ad hoc signing (details in the area changelogs).
- Doc truth-up: FS-01/02/07 `Status:` flipped to `Implemented`; FS-03 header corrected.
- **Deferred:** CI wiring (macOS + emulator runners, area:sre). **Gotchas:** check `simctl list devices booted`/`adb devices` before the wrappers; Docker Desktop needs `open -a Docker` first.

## 2026-07-09 — Native migration Phase 1: iOS + Android specialists replace the Mobile (Expo RN) specialist

- Mobile moves to native `apps/ios` (Swift/SwiftUI) + `apps/android` (Kotlin/Compose); `apps/mobile` frozen as reference until parity. First target: FS-07 client + FS-01.
- Knowledge inheritance: `docs/migration/rn-native-handoff.md` (binary contracts — vault wire format `base64(IV‖TAG‖CT)`, phone hash `sha256("SALT:E164")` —, business rules, divergences) + `docs/migration/vault-test-vectors.json` as the objective interop gate. Both new agent files import them as binding.
- Added `agents/{ios,android}-specialist.md`, registered in the render script; deleted `agents/mobile-specialist.md` + rendered copies (the script never cleans orphans — manual by design). Docs updated (`CLAUDE.md`, STATUS, directives).
- **Follow-up:** re-run `/speckit-constitution` to resync. **Gotcha:** new subagents need a session restart.

## 2026-07-09 — New agent: Spec ↔ Notion Liaison Specialist (area:notion-liaison) + French spec mirror

- Added `agents/notion-liaison-specialist.md` — sole bridge between `docs/specs/FS-*.md` (English, canonical) and their French Notion mirror ("Swab — Spécifications (FS-*)") for the non-dev co-founder, who can freely edit/comment. Requirement IDs preserved verbatim as anchors.
- New `docs/specs/.notion-sync.json` (agent-owned): full content snapshots per spec, re-diffed on every invocation. If both sides changed since last sync → stop and report the conflict, never pick a side (G4).
- **Gotcha:** pages were created under Hamza's own Notion account — sharing with the co-founder is a manual step.

## 2026-07-09 — First spec-kit pipeline test: specs/001-envie-match

- `/speckit-specify` run against approved FS-05 as a fidelity test: `specs/001-envie-match/spec.md`, all 16 ENV-* IDs traced to FR-001…016; FS-05 stays authoritative (stated in the header).
- **Gotcha:** spec-kit's "technology-agnostic success criteria" doesn't fit privacy/concurrency properties — documented as a deliberate exception. Next: `/speckit-plan` + `/speckit-tasks` before migrating other specs.

## 2026-07-09 — New agent: Design & Blueprint Specialist (area:design)

- Added `agents/design-specialist.md` — owner of the blueprint → spec → code pipeline front: `blueprints/`, the Penpot design system/prototype (MCP plugin), the « Nuit » charter. Includes field-tested Penpot gotchas (browser-active page writes, async layout, white default fills, hex-only fills, spurious `:error`s).
- **Gotcha:** new subagents need a session restart.

## 2026-07-09 — GitHub spec-kit adopted for spec-driven development

- Installed spec-kit (`specify init --here --integration claude`): `.specify/` + 8 `speckit-*` skills. Constitution v1.0.0 mirrors — not duplicates — `agents/_global-directives.md`; the directives win on conflict, resync via `/speckit-constitution`.
- Existing FS-* specs are not migrated; spec-kit is for new feature scaffolding. Requires `uv` locally. `RATIFICATION_DATE` is a TODO (original adoption date unrecorded).

## 2026-07-07 — Nuit design system: consolidated prototype, token contract, design agent widened

- New « Nuit » system derived from the consolidated prototype, saved as `docs/design/swab-prototype-consolidated.html` (normative, iPhone 17 gabarit). `docs/design-system.md` is the token contract (nuit/étoile/sauge/ciel/corail palette, Space Grotesk + Inter scale, component grammar) — supersedes the earthy `#16120D` blueprint palette.
- Merged into the existing area:design agent (scope widened to `docs/design-system.md` + `packages/ui` foundations); web agent's stale palette note fixed; renders regenerated. Penpot library built from the contract via the MCP plugin.

## 2026-07-06 — Repo-wide ESLint (flat config): `lint` is now a real gate

- Root `eslint.config.mjs`: typescript-eslint `recommendedTypeChecked` (via `projectService`) + prettier last; extras: `eqeqeq`, `no-console` (G3), `switch-exhaustiveness-check`; test-file relaxations. All packages run real `eslint .`; `turbo.json` invalidates lint caches on config edits.
- New root devDeps: eslint 9, @eslint/js, typescript-eslint 8, eslint-config-prettier. **Gotcha (pnpm):** keep eslint majors aligned across packages or peer auto-install creates duplicate plugin instances ("Cannot redefine plugin").

## 2026-07-06 — Agent prompts consolidated to one source + render script

- `agents/*.md` is the ONLY editable location; `scripts/render-agents.mjs` generates `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, and `.claude/agents/*.md` (thin `@`-import wrappers, tracked in git). `--check` exits non-zero on stale renders (CI follow-up, area:sre).

## 2026-07-06 — Maintainability pass: status doc, per-area changelogs, agent upgrades

- Added `docs/STATUS.md` (single what-is-done summary) + per-area `CHANGELOG.md` files seeded from git history; changelog updates made part of every Definition of Done (now rule G5).
- Agent prompts upgraded with changelog/status duties + field-tested gotchas; `.gitignore` hardened; README setup/run corrected (Docker-first local dev).

## 2026-07-05 — Local dev stack + Android tooling

- `docker-compose.yml`: Postgres 17 (:5432), API (:3001, schema push on boot), Adminer (:8080); `apps/api/Dockerfile`.
- `scripts/`: Android SDK/emulator setup + iOS/Android quick-starts; `ANDROID_SETUP.md`, `DEVELOPMENT.md`; two AVDs provisioned.

## 2026-07-04 — Project foundation (commits 02a3739, 456bf42, 66e2f03)

- Monorepo init: Turborepo + pnpm, strict TS, blueprints, `docs/` (product overview, playbook, FS-01..07 specs with stable requirement IDs), domain spec, AIDD blueprint.
- Agents v1: `agents/_global-directives.md` + five specialists, rendered for Copilot + Claude Code. CI skeleton (`ci.yml`).
