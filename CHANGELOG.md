# Changelog — repo root (area:devops · docs · agents · design · specs · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, design, specs, scripts, workspace config.
> Per-area history: [apps/ios](apps/ios/CHANGELOG.md) · [apps/android](apps/android/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets, ≤ ~15 lines per entry (G5). Updating the right changelog is part of every Definition of Done.

> Entries before 2026-08-15 are archived in [docs/archive/CHANGELOG-pre-2026-08-15.md](docs/archive/CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

## 2026-08-17 — [scope-guard] `suggestions/**` is allowed from any area

- `suggestions/README.md` requires an implemented suggestion to move to `done/<area>/` and the open/done counts to be updated — bookkeeping every area owes on its own PR, on a tree no area prefix owns. The guard rejected exactly that diff, so the duty was unsatisfiable and the moves silently never happened: PRs #76/#77/#78 all left their suggestion sitting in the open folder.
- Moved `suggestions/` into `SHARED_ALLOWED_PREFIXES`, next to `pnpm-lock.yaml` and `docs/STATUS.md` — same category: files every area must touch, owned by none.
- Only the *path* is shared; a PR still has to be reviewed on its contents. 2 new cases (one `area:db`, one `area:backend`, to pin that the allowance isn't area-specific), 22/22 pass — verified red before green.

## 2026-08-17 — [scope-guard] `pnpm-lock.yaml` is allowed from any area

- Adding a dependency to **any** package rewrites the workspace lockfile, and no area prefix owns it — so every dependency-adding PR failed the scope check unless it also carried `area:sre`. G4 allows new dependencies with justification; the guard was rejecting the diff that justification necessarily produces.
- Moved `pnpm-lock.yaml` into `SHARED_ALLOWED_PREFIXES`, next to `docs/STATUS.md` and `docs/qa/` — the same category: files every area must touch, owned by none.
- **The root `package.json` deliberately stays `area:sre`.** Workspace-level `pnpm.overrides` and shared devDependencies are still an infra decision; only the lockfile is shared. Pinned by a test.
- Found by #74 (`area:db`), which adds a dev-only test runner. 2 new cases, 20/20 pass.

## 2026-08-16 — [FCH-09, ADR-001 stage 0b] Freeze the classification value vocabulary as stable identifiers

- **New FS-03 requirement `FCH-09` + a normative *Stored value vocabulary* table.** État, Ressenti and Rôles·contexte now have frozen ASCII identifiers (`busy`, `ambivalent`, `colleague`…); the French words stay normative *display copy*, resolved at render time. Intimité is exempt — already an integer ring.
- **Why now:** ADR-001 makes these values database columns at stage 2. Today both apps persist the French display string, so rewording a label — or shipping the planned Arabic locale — would orphan every stored value. After stage 2 that stops being a client bug and becomes a data migration, which is why 0b is a hard prerequisite.
- **Two judgment calls are flagged in the table, not buried:** `cohort` for « promo » (no one-word English cognate; `promo` reads as "promotion") and `neighbor` over `neighbour`. Both are cheap to overrule — no production data exists. État/Ressenti involved no choice: their identifiers are the i18n key suffixes both platforms already ship.
- **Dual-read is permanent, not a cutover.** Legacy French tokens still decode; an unrecognised token is preserved verbatim and renders as unset, never dropped and never throwing. That is what keeps `vault-test-vectors.json` (`"ressenti":"douceur"`) valid — those are AES-GCM byte vectors whose plaintext is opaque to the crypto layer.
- **Cross-refs updated so the contract has one home:** FS-04 (FCA consumes role *identifiers* — two devices would otherwise derive different lattices after a rewording), FS-06 FLT-01 (rule cases store the identifier), `rn-native-handoff.md` §2.5 (marked NO LONGER the contract for these three fields), ADR stage table, `docs/STATUS.md`.
- **Not done here:** the platform halves (`SUG-IOS-011` + Android mirror) land next as `area:ios` / `area:android` PRs, each adding its own `FCH-09` entry to `docs/qa/e2e-coverage.json` when its unit tests exist. FS-03's Notion mirror needs a liaison re-sync.

## 2026-08-16 — [docs-hygiene] Cut ~230 KB of duplicated//historical content out of the agent-readable surface

- **Nothing deleted.** Every byte is still in git, and moved content is linked both ways. Verified 0 broken internal markdown links repo-wide afterwards.
- **`.notion-sync.json` 80 KB → 45 KB (-43%).** Dropped `lastSyncedEnglish`: it duplicated `docs/specs/FS-*.md` verbatim. Replaced by `lastSyncedEnglishCommit` + `lastSyncedEnglishSha256`; proved lossless by finding, for all 7 specs, the exact commit whose blob reproduces the stored snapshot. **`lastSyncedFrench` deliberately kept inline** — Notion is its only other copy, so hashing it *would* lose information. Liaison agent + `$schema` updated; its rule 4 now says English-via-git, French inline.
- **Active changelogs 196 KB → 30 KB.** Entries before `2026-08-15` moved to `docs/archive/*-pre-2026-08-15.md`. That date is the lint's `GRANDFATHER_DATE`, so the active files now hold only guard-enforced entries.
- **New `MAX_CHANGELOG_CHARS` (40 KB) whole-file cap in `docs-hygiene-lint`,** with 5 tests — including one proving the actual failure mode: every entry compliant, file still 111 KB. Per-entry budgets alone never caught that. Archive files are exempt by construction (the walker only lists active changelog paths).
- **`suggestions/` reorganised:** 76 completed suggestions moved to `done/<area>/`; `<area>/` now holds only the 38 still open. 165 README links repointed, area table rebuilt as open/done.
- **`docs/migration/` — smaller change than planned, on purpose.** `rn-native-handoff.md` is named "binding, read before any task" by both mobile agents and holds the live phone-hash contract; `vault-test-vectors.json` is loaded by passing tests. Archiving those would have broken live references. Only `rn-audit-map.md` moved. Added `docs/migration/README.md` stating per file what is binding vs history — the real cost was agents reading 40 KB to work that out.

## 2026-08-16 — [G2 E2E gate] Android E2E runnable without Docker; fail fast on unsupported emulator images

- `scripts/e2e-android.sh` now points at `pnpm --filter @repo/api dev:local` (no database) alongside the `docker compose` route when its API preflight fails, so a missing Docker daemon no longer reads as "the gate cannot be run here". It could always be run — nobody had noticed the API's persistence is an injected seam.
- **New preflight: emulator API level.** The pinned Espresso reflectively calls `android.hardware.input.InputManager.getInstance()`, removed in newer platforms, so on API ≥ 35 every Compose UI test dies inside `Espresso.onIdle` before any app code runs — 23/37 failures with nothing app-side to fix. The script now refuses to start and names the cause, instead of leaving someone to debug bogus failures. Override with `ALLOW_UNSUPPORTED_API=1`.
- **Gotcha:** API 34 is the known-good image (the `Pixel_6_Pro` AVD); API 37 is not. Remove this guard once issue #56 bumps `androidx.test`/Espresso and the suite is green on a current image.
- Verified on this machine: full gate PASS 37/37, zero drift, on API 34 with the no-database API.

## 2026-08-16 — [#64, SGR-01/05/07, FLT-06, FCH-01/04, ONB-02, ENV-19, MAP-01/05, VLT-01..10] Reconcile all seven specs with ADR-001

- Full read of FS-01..07 against ADR-001 and line-level reconciliation (issue #64). FS-04 and FS-06 carried the most contradictions (`SGR-07` "the server never sees subgroup structure", `FLT-06` "exist only on-device") — both unbuilt, so cheap to correct. FS-02 needed wording only: offline-first rendering survives intact, vault → cache.
- **`OQ-SGR-2` resolved — FCA stays on-device** over the local cache. It is a pure deterministic function already locked by cross-platform test vectors; keeping it local preserves instant re-detection and the offline guarantee, and moving it server-side would buy nothing today. Only user-authored subgroup state (names, pins, hidden) is persisted. Revisit if `apps/web` ever needs subgroups.
- Built specs (FS-01/03) use the transitional pattern already set by `ONB-05`: each states current behaviour *and* the post-migration requirement, so spec, tests and shipped code stay coherent mid-migration. `docs/STATUS.md` gains a 🟢⚠️ state — FS-01/02/03 are green but built against a superseded design.
- **Gotcha caught in review:** `VLT-01` listed the subgroup *lattice* as server-stored while `SGR-07` says it is derived on-device — contradictory. `VLT-01` now distinguishes stored user-authored state from the derived lattice.
- **`ENV-05` corrected.** An earlier ADR-001 edit said scope resolution MAY run server-side "now that filter rules and subgroups are stored there" — that over-generalised: filter rules are stored server-side, subgroup *membership* is not (the lattice is derived on-device, SGR-07). The server cannot resolve a portée, so resolution stays on-device and the client sends the final recipient list.
- **New `SGR-09` — cross-platform parity is a hard gate.** Both platforms load one shared `docs/specs/vectors/fca-test-vectors.json` (never transcribed per-platform) and their unit suites fail on any mismatch; both already run in CI. Normative sub-rules target where Swift and Kotlin diverge by default: explicit sort order (never `Set` iteration), NFC + Unicode code-point comparison (Kotlin's `compareTo` is UTF-16 code-unit order, Swift's `<` applies canonical equivalence — neither is code-point order, and « é » has two encodings), and integer-only threshold arithmetic. A hand-verified worked example is embedded in FS-04 as the first vector.
- New `OQ-FLT-2` (where filter evaluation runs — affects whether the evaluator needs a TS implementation too). Notion mirror flagged stale; re-sync deferred until #64 closes, per its own instruction not to sync mid-review.
- Out of scope by design: replacement French copy for the three known-false privacy strings (ADR-001 stage 6) — flagged in-place in FS-01 rather than invented.

## 2026-08-16 — [ADR-001, FS-07 VLT-01..06, IDT-05, OQ-IDT-2] Retire end-to-end encryption; database becomes the single source of truth

- **Decision (founder):** relationship classification data (intimité, rôles, état, ressenti, filter rules, subgroups, history) moves from the on-device encrypted vault into server-side Postgres columns. Recorded in the repo's first ADR, `docs/decisions/ADR-001-server-side-classification-data.md`, including the alternatives rejected and the costs accepted.
- **Why:** device loss/theft/replacement previously meant permanent, unrecoverable data loss (old VLT-05) with no recovery path built, plus the cost of maintaining encrypted dual state. Recovery is now ordinary re-authentication. Resolves the long-standing OQ-IDT-2.
- **Rules updated so agents stop enforcing the retired invariant:** G1 in `agents/_global-directives.md`, `CLAUDE.md` hard boundaries, spec-kit constitution (**1.1.0 → 2.0.0**, MAJOR — a principle is redefined incompatibly), and the six specialist agent files that carried their own copies (ios, android, backend, data, design, specs). Renders regenerated via `node scripts/render-agents.mjs`.
- **Honesty pass:** product law 4's « ni eux, ni nous » claim and the design-system reassurance copy (« elle ne voit jamais votre classement ») are now false and were rewritten. New VLT-06 forbids any copy implying E2EE. What still holds — no other user sees your classement, one-directional links (IDT-08), strictly mutual reveal, nothing in logs — is restated rather than dropped.
- **Gotcha — priorities changed:** with no client-side encryption, the session token is now the only thing guarding a user's full dataset. `SUG-AND-006` (JWTs stored as plaintext in DataStore despite the `KeystoreTokenStore` name) and `SUG-API-002` (refresh rotation + reuse detection) are upgraded to high impact and should land **before** the migration, not after.
- **Option D, not plain "drop E2EE".** A second review re-costed the alternatives: full E2EE + CRDT was rejected on evidence (the local-first E2EE ecosystem is TS/web-only — Jazz is React-first, Evolu/Zero are TS, Automerge's encrypted sync isn't production-ready, CloudKit CRDT is Apple-only — so a native Swift+Kotlin app would build it twice by hand). The decision therefore also commits to fixing the **sync model** (new FS-07 VLT-07..10: per-record idempotent writes, server-assigned `updatedAt`, cursor delta pulls, field-level LWW + tombstones, durable offline outbox) and to keeping `Envie.verb` encryptable later (new FS-05 ENV-20).
- **Gotcha — the blob, not the crypto, caused the multi-device bug.** Dropping E2EE while keeping whole-state push would still lose updates across two devices. Storage format and sync granularity are independent; only the second fixes consistency.
- **Not built yet.** This PR is the decision and the doc layer only. Stages: **0a spec review (issue #64)** + 0b `SUG-IOS-011` + 0c token hardening → schema → API → clients → backlog re-triage → French copy. Stage 2 must not start before 0a/0b. `docs/migration/vault-test-vectors.json` and the vault wire format are now historical; do not build new work against them.

## 2026-08-15 — Dependabot triage: 12 bumps merged, 8 declined

- **Merged, all green:** eslint 9→10, pino 9→10, `@fastify/rate-limit` 10→11, the npm-minor-patch
  group, gradle-wrapper 8.13→**9.7.0**, turbine 1.2.1, and six Actions pins (setup-java v5,
  setup-node v7, cache v6, setup-gradle v6, gitleaks-action v3, checkout v7). The Node 20 runner
  removal (2026-09-16) forced the last two — `pnpm/action-setup` is *not* affected, so #53 was
  declined (its v6 installs pnpm 11 alongside our pinned 10.12.1).
- **Gotcha:** Dependabot **retargeted the wrapper PR from 9.6.1 to 9.7.0 during a rebase** — read
  the head commit, not the PR title, before claiming a version.
- **`@eslint/js` bumped by hand to ^10.0.1** — Dependabot versions it separately, so it silently
  held `eslint:recommended` at the v9 rule set. That surfaced `preserve-caught-error` (new in v10),
  fixed in `apps/api/tests/prisma-repo.test.ts` with `{ cause: err }`.
- **Gradle 9.7.0 verified locally against AGP 8.5.2** (CI only runs `./gradlew test`): jacoco, both
  assembles and R8 `assembleRelease` pass. Warns "incompatible with Gradle 10" — see #56.
- **Declined:** Prisma 6→7 #36, postgres 17→18 #24, Node 26 #57 (26.x ignored), Android toolchain #56.

## 2026-08-15 — [SUG-OPS-003/004] Trivy gate back to green (zero HIGH/CRITICAL)

- `trivy-api-image` had been red since it landed — 23 findings (22 HIGH, 1 CRITICAL) from **two**
  sources needing different fixes.
- **A stale lockfile** (`brace-expansion` 1/2/5, `fast-uri`, `find-my-way`, `js-yaml`, `nanoid`,
  `postcss`) → refreshed via `pnpm update --depth Infinity <pkgs>`. Each patch was already inside
  its parent's range; plain `pnpm install` won't take it (sticky). `pnpm.overrides` were tried
  first, verified redundant, dropped.
- **npm bundled in `node:22-slim`** (`tar` CRITICAL, `sigstore`, `ip-address`) → unreachable by
  any override (zero entries for all three in `pnpm-lock.yaml`), so the Dockerfile's **prod stage
  now deletes npm/corepack/npx**: it runs `node dist/server.js` with a `node -e` HEALTHCHECK and
  never shells out to a package manager — least-privilege (G1), not scan suppression. `dev`/
  `build` keep pnpm. Gotcha: if a runtime dep ever needs npm at boot, move that `rm` later.
- `scripts/scope-guard.mjs`: root `package.json` + `pnpm-lock.yaml` were in **no** area map, so
  this PR tripped the guard. Added both to `area:sre`/`area:devops` (exact-match) + tests.

## 2026-08-15 — [docs-hygiene] Mechanical CI gate for G5's changelog/STATUS budgets

- G5's "changelog entries ≤ 15 lines" and "STATUS.md notes 1-2 lines" were the only rules with no
  guard (unlike render-agents/generate.mjs/portability-lint/scope-guard), which is how they drifted
  quietly to a 4,387-char row and multiple 20+ line entries before this PR's siblings fixed them.
- Added `scripts/docs-hygiene-lint.mjs` (+ table-driven `node --test` unit tests, same shape as
  `portability-lint.mjs`), wired into `ci.yml` right after the portability-lint steps.
- Only checks changelog entries dated on/after `GRANDFATHER_DATE` (2026-08-15) — history is
  append-only and is never retro-edited to fit; old oversized entries pass untouched.
- Changelog scan globs `apps/*/CHANGELOG.md`, so a future `apps/web/CHANGELOG.md` is picked up with
  no code change.

## 2026-08-15 — [docs-hygiene] Compact docs/STATUS.md back to its own "1-2 lines" rule

- `docs/STATUS.md:54` states "Keep notes to one or two lines — history belongs in the changelogs,
  not here" (G5), but four rows had drifted into paragraph-length blow-by-blow history — worst was
  the design-system row at 4,387 chars (485 words) in a single table cell.
- Trimmed the intro blockquote, CI, DB migrations, and design-system rows to current-state +
  pointers. Every fact removed was verified present in root `CHANGELOG.md` first (all cited
  `SUG-DES-*`/`SUG-OPS-*`/`SUG-DB-002` ids already have entries there) — nothing lost, only
  de-duplicated. Table structure, status emoji, and the Changelogs/How-to-update sections unchanged.
- No line in the file now exceeds 450 chars (was up to 4,387).

## 2026-08-15 — [docs-hygiene] Stop listing unbuilt packages as if they exist

- `CLAUDE.md` and `agents/_global-directives.md` named `apps/web`, `packages/api-client`,
  `tools/orchestrator` alongside real packages with no "planned" marker — a G5 truthfulness
  violation (`docs/STATUS.md` already correctly said "not created yet"). Every agent session reads
  this sentence first, so it mis-primed every task.
- Split each inventory sentence into what exists vs. "Planned, not yet created… see `docs/STATUS.md`".
- Re-ran `node scripts/render-agents.mjs` to resync `.github/copilot-instructions.md` (the only
  rendered copy that bakes in this sentence — `.claude/agents/*.md` and `.github/instructions/*.md`
  use `@`-imports and needed no change).
- Left forward-looking references alone on purpose (scope-guard's map, agent scope declarations,
  `aidd-multi-agent-blueprint.md`, `docs/design-system.md`) — those already describe planned state.

## 2026-08-15 — Fix @repo/db CI race: typecheck/test/build now generate their own Prisma client

- `turbo.json`: `lint`, `typecheck`, `test` and `build` depended only on `^db:generate` (`lint` had no `dependsOn` at all), which runs the task in *dependency* packages. `@repo/db` has no such dependency, so `@repo/db#typecheck` resolved to zero upstream tasks and raced `@repo/db#db:generate` — visible in CI logs as both starting in the same second.
- Added the unprefixed `db:generate` alongside `^db:generate` so each package also waits for its own generator. Packages without the script skip it, so this is safe repo-wide.
- `lint` is type-aware, so without the generated client every rule reports `Unsafe … of a type that could not be resolved` in `prisma/seed.ts` — same race, different task.
- Effect: `main` has been red since 2026-08-10 with `@repo/db#typecheck` failing on `Module '"@prisma/client"' has no exported member 'PrismaClient'` (plus `EnvieStatus`, `MatchState`, `Platform`, `ProposalState` in `prisma/seed.ts`). Every PR inherited the same red `ci`, masking real breakage.
- Gotcha: this never reproduced locally. A previously generated client persists in `node_modules/.pnpm/@prisma+client@…/node_modules/.prisma/client`, so `tsc` resolves the types regardless of task order; only CI's fresh `--frozen-lockfile` install exposes it.

