# Changelog — repo root (area:devops · docs · agents · design · specs · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, design, specs, scripts, workspace config.
> Per-area history: [apps/ios](apps/ios/CHANGELOG.md) · [apps/android](apps/android/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets, ≤ ~15 lines per entry (G5). Updating the right changelog is part of every Definition of Done.

## 2026-08-09 — Point ios-/android-specialist at newly installed community skills

- Installed 4 third-party Claude Code skill plugins globally (user scope, not repo-tracked): `all-ios-skills@swift-ios-skills` (dpearson2699, 86 skills incl. `cryptokit`/`swift-security`/`swiftui-*`), `android-skills@android-skills` (rcosteira79, Compose/coroutines/Room/testing), `claude-android-ninja` (Drjacky), `android-development` (dpconde).
- Added an "Installed reference skills" section to `agents/ios-specialist.md` and `agents/android-specialist.md` naming the relevant skill per topic and instructing agents to consult it via the Skill tool before implementing unfamiliar framework details from memory.
- **Explicit caveat added to both:** these are general third-party skills, not Swab-aware, and never override this file's Project Rules — most notably `android-development`/`claude-android-ninja` default to Hilt DI, which Swab deliberately doesn't use (manual `AppContainer` injection); reference for idiomatic API usage only, never architecture.
- Regenerated `.github/instructions/{ios,android}.instructions.md` via `node scripts/render-agents.mjs` (Copilot copies only — the Claude Code `.claude/agents/*.md` wrappers are thin `@`-imports and don't duplicate content, so they needed no re-render).
- Gotcha for future sessions: these skill installs are user/global scope, not part of this repo — a fresh clone or CI runner won't have them; they're a local productivity aid, not a build dependency.

## 2026-08-09 — [ONB-04, MAP-01, FCH-01, OQ-ONB-1] Propagate frozen 4-ring resolution to French Notion mirrors

- Checked all three live Notion pages (FS-01/02/03) and their comments/discussions before touching anything — none had unresolved feedback or co-founder edits, so this was the "code changed only" case on all three, not a conflict.
- Translated the `docs/specs/` code-side diff (commit `ddeae69`) to French and pushed via targeted `update_content` search-and-replace: ONB-04's row now states the 4-ring enumeration normatively; OQ-ONB-1's paragraph carries the `RÉSOLU (2026-08-09, SUG-SPEC-009)` resolution text; MAP-01 (FS-02) and FCH-01 (FS-03) rows now cross-reference ONB-04 without the stale `(actuellement OQ-ONB-1)` parenthetical.
- Re-fetched FS-01's page after writing to confirm the edit landed correctly.
- `docs/specs/.notion-sync.json` snapshots (`lastSyncedEnglish`/`lastSyncedFrench`/`lastSyncedAt`) updated for FS-01/02/03 to the new content, closing the drift window.
- FS-05's mirror was already caught up as of this morning's separate sync — untouched here.
- No `docs/STATUS.md` change: the OQ was already resolved code-side in `ddeae69`; this sync only propagates it to Notion, it doesn't itself change implementation-readiness.

## 2026-08-09 — [OQ-ONB-1] Correct Onboarding blueprint's INTIMACY constant to the frozen 4-ring model

- Blueprint side of OQ-ONB-1: `blueprints/swab - Onboarding (standalone) (1).html`'s embedded `INTIMACY` constant defined 5 rings (`intime`/`proche`/`ami`/`lien faible`/`connaissance`, r:34/55/78/102/130) that were never shipped. Replaced with the canonical 4 rings sourced identically from `apps/ios/Sources/SwabCore/L10n/Fr.swift:163-166` and `apps/android/.../l10n/Fr.kt:59-62`: `Très proche` (r:34) / `Proche` (r:66) / `Familier` (r:98) / `Plus loin` (r:130).
- Radii: kept the original min (34) and max (130), evenly redistributed the 4 rings across that span (step 32) rather than dropping one of the original 5 values — no shipped code depends on these numbers, visual reference only.
- Added a `CORRECTED 2026-08-09 (OQ-ONB-1)` header comment next to the existing `SUPERSEDED 2026-08-08` palette note, pointing at the two app L10n files as the actual source of truth for the intimacy taxonomy going forward.
- Searched `docs/design-system.md` and `docs/design/swab-prototype-consolidated.html` for the old labels/radii — no matches, nothing else to fix there.
- Found (not fixed, out of scope): 3 other blueprint files still embed the stale 5-ring labels/keys as unrelated local mock data — `swab - Carte des relations (standalone).html`, `swab - Fiche contact (standalone) (1).html`, `swab - Flux envie et match (standalone).html`. None define a canonical `INTIMACY` source; flagged for a follow-up sweep.

## 2026-08-09 — [ONB-04, MAP-01, FCH-01, OQ-ONB-1] Freeze 4-ring enumeration as canonical (SUG-SPEC-009)

- **RESOLVED OQ-ONB-1** (founder decision): the shipped 4-ring model — `Très proche` / `Proche` / `Familier` / `Plus loin`, sourced identically from `apps/ios/.../L10n/Fr.swift:153-156` and `apps/android/.../l10n/Fr.kt:59-62` — is frozen as canonical. The Onboarding blueprint's 5-ring model (`intime`/`proche`/`ami`/`lien faible`/`connaissance`) was the artifact that disagreed with ship; it gets corrected to match, not the other way around. No retrofit of either app.
- ONB-04 (`docs/specs/FS-01-onboarding.md`) now states the enumeration normatively instead of pointing at an open question.
- MAP-01 (`docs/specs/FS-02-relationship-map.md`) and FCH-01 (`docs/specs/FS-03-contact-card.md`) updated to cross-reference ONB-04 instead of duplicating or pointing at the now-resolved OQ.
- FS-04's SGR-01 (shared ring enumeration, SUG-SPEC-005 test vectors) can now depend on this fixed value.
- Out of scope here: the `CalibrateScreen` rings-3/4 text-wrap bug and its coverage-manifest note (`docs/qa/e2e-coverage.json`) — unaffected by this freeze, tracked separately in `docs/STATUS.md`.
- Follow-up: design-specialist owns correcting the blueprint HTML to the 4-ring model in parallel; notion-liaison-specialist should resync FS-01 (and FS-02/FS-03 if their tables changed) once both land.

## 2026-08-09 — [SUG-DES-011] Minimum touch target token + normative contract

- Added `component.touch.minTarget: 44` to `tokens.json` — regenerated as `DesignTokens.Component.Touch.minTarget` (Swift) / `Component.Touch.MIN_TARGET` (Kotlin) / `component.touch.minTarget` (TS) / `--component-touch-min-target: 44px` (CSS). No `generate.mjs` code changes needed — the component renderers are already generic over arbitrary groups/keys.
- New normative "Minimum touch target" paragraph in `docs/design-system.md` §3, after the existing "Hit targets" bullet: every interactive element gets a ≥44×44pt(iOS)/48×48dp(Android) hit region extended invisibly beyond smaller visual bounds (tag ≈34px, segmented cell ≈40px, switch 21px tall, measured live in Penpot) — visual geometry unchanged, hit area only.
- Penpot: annotated the 14 affected component instances (tag/sel, tag/default×2, tag/chip, tag/gris, seg/sel, seg/opt×5, seg/retrait, switch/on, switch/off) in the "Swab — Design System" page with a non-visual `setPluginData` note pointing at the new token and the iOS/Android hit-area technique — no shape geometry touched.
- App code untouched — hit-area adoption on Tag/Segmented/Switch composables is a follow-up `area:ios`/`area:android` proposal.

## 2026-08-09 — [ENV-07, OQ-ENV-2, OQ-ENV-4, OQ-ENV-5] Sync FS-05 French Notion mirror after 48h + accept/decline resolutions

- Checked FS-05's live Notion page and comments (per liaison mandatory first step): page content matched `.notion-sync.json`'s `lastSyncedFrench` exactly and had zero open comments — Notion side untouched since the last sync (2026-08-08). No conflict.
- Code side had drifted across three commits since that sync, not just the one requested (SUG-DES-010's ENV-07 48h freeze): OQ-ENV-4's accept-copy resolution (`« Accepter la proposition »`, issue #19) and OQ-ENV-5's decline-mechanism resolution (pass is the only decline, issue #20) had also never reached Notion. Propagated all three in one pass — pure "code changed only" case, translated and pushed via `update_content` (8 targeted search-and-replace ops: ENV-07, ENV-13, ENV-14, ENV-17, the API-contract line, OQ-ENV-2, OQ-ENV-4, OQ-ENV-5).
- Frozen French copy (`« Elle expire dans 48 heures. »`, `« Accepter la proposition »`) carried through verbatim, not re-translated. "Source canonique" note at the top of the page left in place.
- `docs/specs/.notion-sync.json` FS-05 entry: `lastSyncedAt`, `lastSyncedEnglish`, `lastSyncedFrench` refreshed to current state (other specs' entries untouched).
- No `docs/STATUS.md` change: this sync doesn't resolve a new open question — the resolutions already happened in prior code commits, this only mirrors them to Notion.

## 2026-08-09 — [SUG-DES-006] État node palette added to the token SSOT (MAP-03)

- Added `etat-disponible` (`#8FB59A`), `etat-occupe` (`#C8917E`), `etat-ailleurs` (`#8AA0BE`) to `tokens.json`'s `color` group — extracted **verbatim** from `apps/ios/Sources/SwabCore/Carte/EtatColors.swift` and `apps/android/.../carte/EtatColors.kt`, values unchanged (do NOT harmonize toward sauge/corail/ciel — they're a distinct off-charter palette by design).
- New "État (MAP-03)" sub-table in `docs/design-system.md` §1, with the divergence note: blueprint's 5-état taxonomy vs. shipped 3-état vocabulary, plus a flag that the 4th value (`en pause`) is intentionally excluded here because iOS (`#9A8FB5`) and Android (`#A69CB0`) currently disagree on its hex — a separate, still-open drift.
- Regenerated all four outputs; `DesignTokens.Color.etatDisponible/etatOccupe/etatAilleurs` (Swift), `Color.ETAT_DISPONIBLE/ETAT_OCCUPE/ETAT_AILLEURS` (Kotlin) now exist.
- App code untouched (`EtatColors.swift`/`.kt` still hand-hold their own literals) — repointing them to the new SSOT tokens is a follow-up `area:ios`/`area:android` proposal, not done here.

## 2026-08-09 — [ENV-07] Resolve envie TTL: 48h wins over 24h assumption (SUG-DES-010)

- Founder decision: **48h** is the canonical envie expiry, matching the prototype's confirmation copy « Elle expire dans 48 heures. » (`docs/design/swab-prototype-consolidated.html:524`). `docs/specs/FS-05-envie-match.md` ENV-07 amended: default 24h → 48h, ⚠️ ASSUMPTION marker removed, the exact French sentence frozen inline (matches ENV-13's inline-freeze convention — FS-05 has no separate copy-inventory section).
- ENV-17's `expiresAt` validation bound was already `(now, now + 48h]`; noted it now equals the confirmed default. Its stale "24h-vs-midnight" reference to OQ-ENV-2, and OQ-ENV-2's own wording, updated to "48h" so the still-open rolling-vs-midnight-anchor question isn't attached to a now-wrong number.
- `blueprints/swab-app-prototype.html` still exists but only as the SUG-DES-013 pointer stub (no prototype content of its own) — left untouched, nothing to resurrect.
- `suggestions/README.md` DES-010 row, Wave-D sequencing note, and the "already-good" audit bullet marked resolved.
- No code change: `docs/design/swab-prototype-consolidated.html` already said 48h; only the spec was wrong.
- Follow-up not in scope here: ENV-17's separate `N=150` recipient-count assumption is still pending Hamza's sign-off.

## 2026-08-09 — [SUG-DES-012] Dynamic-Type scaling contract + letterSpacing → letterSpacingEm rename

- Added a normative scaling paragraph to `docs/design-system.md` §2: type scales with the platform text-size setting (Dynamic Type/`UIFontMetrics` on iOS, `sp` on Android, `rem` on web); SSOT `size` is the default-scale reference; fixed-height components (48pt button) declare a minimum height that grows with text, never clips.
- `tokens.json` typography entries: `letterSpacing` (absolute px) renamed to `letterSpacingEm` (em-relative) — wordmark `5.7` → `0.22`, label `1.1` → `0.1`, all others `0`. `generate.mjs` renderers updated: CSS now emits `letter-spacing: <n>em` instead of `<n>px`; TS/Swift/Kotlin emit `letterSpacingEm`. `validate.mjs` range-checks `[0, 0.5]`.
- Wordmark's charter range (`.22–.24em`, 26–30px) explicitly canonicalized to the smaller pair (26px/.22em) as the single SSOT value — documented in the new contract paragraph so implementers stop guessing which end of the range to use.
- Confirmed zero app-side consumers of the old field name (`grep -rn "\.letterSpacing\b"` — nothing outside `Generated/`), so this was a free rename; landed before SUG-DES-004's typography wiring as required.
- Regenerated all four outputs; `pnpm --filter @repo/ui test` green (validator self-tests + `--check` drift guard).

## 2026-08-09 — [FCH-01] Resolve OQ-FCH-1: real Rôles·contexte and Ressenti vocabularies (closes #15)

- Extracted verbatim from the blueprint's embedded `ROLES`/`VALENCES` consts (`blueprints/swab - Fiche contact (standalone) (1).html`) instead of guessing — Architect approved adopting them as-is. Rôles·contexte (multi-select, 6): famille, partenaire, collègue, promo, communauté, voisin. Ressenti (3, full swap, not an addition): positive, ambivalente, négative — replaces the invented léger/précieux placeholder pair entirely.
- iOS and Android both fixed in the same PR: vocab routed through each platform's localization constants like the other axes; onboarding calibration screens synced. See `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md`.
- `docs/specs/FS-03-contact-card.md` (OQ-FCH-1 marked resolved), `docs/STATUS.md` updated. No real users existed yet, so this was a straight vocabulary swap, not a vault-content migration.
- Gotcha: the same blueprint also revealed État has its own richer 5-value taxonomy (établi/à apprivoiser/en sommeil/en pause/tendu) vs. the 4 shipped today — that's a separate, already-tracked, still-open divergence (`docs/migration/rn-native-handoff.md` §5), untouched by this fix or by #16.

## 2026-08-09 — [FCH-06] Resolve OQ-FCH-2: état is canonical for « en pause » (closes #16)

- Architect decision (issue #16): `en pause` is an ÉTAT value, not Ressenti — resolves the Wave 3 divergence where the spec said état (FCH-06, FS-06 FLT-01) but shipped native code put it under Ressenti. FS-06 wasn't touched — its `état = en pause` default rule already assumed the now-confirmed axis.
- `docs/specs/FS-03-contact-card.md` (OQ-FCH-2 marked resolved), `docs/qa/e2e-coverage.json` + `docs/qa/e2e-scenarios.md` (FCH-06 notes updated), `docs/STATUS.md` updated.
- iOS and Android both fixed in the same PR: `en pause` added as a 4th état value, removed from Ressenti (now 2 values — OQ-FCH-1 still leaves its final vocabulary open), each platform's dual-axis filter-consequence workaround removed. See `apps/ios/CHANGELOG.md` / `apps/android/CHANGELOG.md` for platform detail.
- Gotcha: no color previously existed for "en pause" on either axis, so each platform picked its own new muted/desaturated hex for the état mapping — not blueprint-sourced, flagged as such in-code.

## 2026-08-09 — [ENV-13] Resolve OQ-ENV-4: accept button copy frozen as « Accepter la proposition » (closes #19)

- Design-specialist proposed 3 candidates (grounded in the existing "Flux envie et match" blueprint's tone/verb+object button pattern); Hamza picked **« Accepter la proposition »** — reuses "la proposition" verbatim from ENV-14's already-frozen "Envoyer la proposition" button.
- `docs/specs/FS-05-envie-match.md` (ENV-13, OQ-ENV-4) and `specs/001-envie-match/spec.md` (Acceptance Scenario 1, FR-013, Assumptions) updated — both OQ-ENV-4 and OQ-ENV-5 (FS-05's ENV-13 open questions) are now resolved.
- No prompt copy above the two buttons was requested — screen shows the bare button pair.
- Gotcha: Penpot was checked for a more current source and was unreachable (OAuth needs an interactive session, can't complete non-interactively) — copy is grounded in the static blueprint export only. Worth re-checking against Penpot once it's authorized, in case a newer design disagrees.

## 2026-08-08 — [ENV-13, ENV-14] Resolve OQ-ENV-5: no separate "decline" action, pending-proposal surface is accept/pass only (closes #20)

- Architect decision (issue #20): swab has no refusal philosophy distinct from the soft pass — declining a specific proposal and passing on the match are the same user-facing action. Consistent with `docs/product-overview.md`'s existing glossary entry ("passer cette fois" = soft pass = declining invisibly) and product law 5; nothing in that file needed to change.
- `docs/specs/FS-05-envie-match.md`: ENV-13 rewritten — pending-incoming-proposal surface now offers exactly TWO actions (accept, **Passer cette fois**), the three-action framing and ⚠️ PROPOSED ASSUMPTION marker removed. ENV-14 reworded from "accepts/declines" to "accepts or passes"; terminal states are SCHEDULED (accept) / PASSED for that side (pass), per ENV-15. OQ-ENV-5 marked **RESOLVED (2026-08-08, issue #20)**, kept in place (not deleted) with the decision recorded.
- OQ-ENV-4 (issue #19, left open) reworded: it was scoped to "accept/decline" copy; now scoped to "accept" copy only, since decline no longer exists as a distinct action. The accept button's French copy is still genuinely missing.
- `specs/001-envie-match/spec.md` re-synced: Acceptance Scenario 1, FR-013, FR-014, the Proposal key entity, and the Assumptions bullet all updated to match.
- API contract line (FS-05) and remaining "accept/decline" prose swept for staleness: `POST /proposals/:id/decline` dropped — a pending proposal is passed via the existing `POST /matches/:id/pass`, no separate proposal-decline endpoint needed.
- Not touched: `docs/product-overview.md` (already consistent, verified), OQ-ENV-1/2/3, `docs/STATUS.md` (FS-05 still ⚪ Not started, unaffected by this wording fix).

## 2026-08-08 — Drop OpenAPI generation requirement from backend/devops agent rules (closes #23)

- Decided not to build OpenAPI generation for now; the `openapi:emit`/`openapi:check` scripts were exit-0 stubs anyway (removed in `apps/api`, see its changelog).
- `agents/backend-systems-specialist.md` rule 1 rewritten from a mandatory "Swagger always current" rule to a note that it's deferred, with a pointer to file a fresh issue if picked back up. Its Definition of Done no longer requires `openapi:check` green.
- `agents/devops-infrastructure-specialist.md` rule 4 (required status checks) drops `openapi:check` from the list.
- Regenerated `.github/instructions/backend.instructions.md` and `.github/instructions/devops.instructions.md` via `node scripts/render-agents.mjs` — the two files that changed. `.claude/agents/*` wrappers needed no change (they `@`-import `/agents` at runtime).
- Not touched: historical `suggestions/` docs and past `CHANGELOG.md` entries that reference the old stub — those are records of what happened, not current rules.

## 2026-08-08 — [SUG-OPS-019] Remove dead RN-era pnpm override, document the `tools/*` glob

- Root `package.json`: deleted the `"pnpm": { "overrides": { "react-native-quick-base64": "2.2.2" } }`
  block — a pin for the retired Expo/RN app's autolinking (`apps/mobile`, removed 2026-07-19).
  Verified zero references anywhere (`grep -rn "quick-base64" apps packages` → none) before removing.
- Regenerated `pnpm-lock.yaml`; diff is exactly the 3-line override record removal, nothing else
  (confirms nothing was transitively resolving that pin — the check the suggestion asked for).
- `pnpm-workspace.yaml`: kept the `tools/*` glob (option (a) — `tools/orchestrator` is still named in
  `aidd-multi-agent-blueprint.md`) but added a comment noting it's planned, not yet created, per
  `docs/STATUS.md`.
- Verified: `pnpm install --frozen-lockfile` succeeds; `grep -rn "quick-base64" package.json
  pnpm-lock.yaml` → no hits; `pnpm turbo run lint typecheck test build` → 10/10 tasks green.

## 2026-08-08 — [SUG-OPS-017] `tsconfig.base.json` added to turbo's `globalDependencies`

- `turbo.json`: `"globalDependencies": ["eslint.config.mjs", "tsconfig.base.json"]` — every package's
  `tsconfig.json` extends the root base file, but it wasn't a hashed input, so a compiler-flag change
  there didn't invalidate cached `typecheck`/`build` results. Matters more now that SUG-OPS-009 (this
  same batch) persists the turbo cache across CI runs — a false-green cache hit in CI is worse than
  one on a laptop.
- Verified locally: cold `pnpm turbo run typecheck` → 0/4 cached; immediate re-run → 3/4 cached
  (`db:generate` stays uncached, as always); appending a blank line to `tsconfig.base.json` → next
  run 0/4 cached (full invalidation, as intended); reverted the touch (`git status` confirms no
  residue).

## 2026-08-08 — [SUG-OPS-016] Helper scripts get strict mode (`-u`/`pipefail`), matching the E2E gates

- `scripts/{run-ios,run-android,setup-android-emulator,test-ios-functional,test-android-functional}.sh`:
  `#!/bin/bash` → `#!/usr/bin/env bash` (picks up PATH's bash, not macOS system 3.2) and `set -e` →
  `set -euo pipefail`, matching `scripts/e2e-{ios,android}.sh`'s existing convention.
- `-u` audit found no unset-variable risk needing an explicit default in any of the five (all `$1`/`$2`
  reads are either always-passed function args or already `${1:-default}`-guarded).
- `pipefail` audit found 5 pipelines with a **legitimate** zero-match outcome (booted-simulator lookup,
  OTP-code scrape, two "count exceptions found" checks, two Postgres count queries) that already had
  a graceful fallback a few lines later (`-z` check, log_warn) — without `|| true` on those specific
  pipelines, pipefail would let `set -e` abort the script *before* reaching that graceful path.
  Added `|| true` with a one-line comment on each, per the suggestion's own guidance.
- `shellcheck` (via `docker run koalaman/shellcheck:stable`): zero new warnings from this change; a
  handful of pre-existing style/info-level findings (SC2034, SC2086, SC2126, SC2329) are unrelated to
  strict mode and left untouched (out of this suggestion's scope).
- **Not verified end-to-end on real hardware** (no Xcode/Android SDK/simulator/emulator in this
  environment) — the suggestion's own risk note flags this as something only verifiable on a machine
  with those installed; `bash -n` syntax-checked all five, and shellcheck ran clean of new issues.

## 2026-08-08 — [SUG-OPS-004] Dependabot config (npm, github-actions, gradle, docker, docker-compose)

- Added `.github/dependabot.yml`: 5 ecosystems, weekly cadence (protects free-tier Actions minutes —
  devops project rule 1), `npm` grouped by `minor`/`patch` (one PR/week instead of many for a solo
  maintainer), `open-pull-requests-limit` capped (5 npm / 3 gradle). All five carry `labels: ["deps"]`;
  created the `deps` repo label (`gh label create`) so it actually applies instead of silently no-op'ing.
- **Deviation from the written plan's step 3**: did NOT add an `ignore:` entry for the dead
  `react-native-quick-base64` pnpm override (`package.json`'s `pnpm.overrides`). The plan's own text
  flagged it "for removal... propose separately" — but SUG-OPS-019 (this same devops batch, later
  today) removes that override outright, which would make an `ignore:` entry for it dead config
  within the same day. Skipped rather than added-then-immediately-stale.
- Verified: `.github/dependabot.yml` parses as valid YAML with the exact structure GitHub's schema
  expects (checked via a scratch `pyyaml` parse). Live validation (Dependency graph → Dependabot tab,
  first scheduled run) only happens once this reaches GitHub — noted, not something verifiable
  offline before push.

## 2026-08-08 — [SUG-OPS-015] `.dockerignore`: exclude native apps + local artifacts, drop stale entries

- Added `apps/ios`, `apps/android` (a real on-disk Gradle `build/` dir lives there — can be hundreds
  of MB), `test-results`, `specs`, `suggestions`, `.claude`, `.github` to `.dockerignore` — none of
  these are ever COPYed by `apps/api/Dockerfile` (verified: it only touches root manifests,
  `packages/db`, `apps/api`).
- Removed two dead entries: `.expo` and `apps/mobile` (the Expo RN app was removed 2026-07-19).
- Verified: `docker build -f apps/api/Dockerfile --target dev .` still succeeds; `git grep
  "apps/mobile" .dockerignore` → empty.

## 2026-08-08 — [SUG-OPS-014] Compose: API healthcheck, db/adminer loopback-only, `.env.example` fix

- `api` service gets a `HEALTHCHECK` (`node -e fetch(...)`, no curl/wget in `node:22-slim`; generous
  30 retries / 5s interval / 20s start period since first boot runs `prisma migrate deploy`) — agents
  can now use `docker compose up --build --wait` instead of racing the API's boot.
- `db` (`5432`) and `adminer` (`8080`) ports rebound to `127.0.0.1` only — full DB CRUD UI and
  Postgres no longer reachable from the LAN (G1). `api` (`3001`) stays on all interfaces on purpose:
  physical-phone on-device testing needs it; simulator/emulator flows use localhost regardless.
- Fixed `apps/api/.env.example` and `packages/db/.env.example`: `DATABASE_URL` now matches compose's
  actual creds (`swab`/`swab_local_dev`), was `postgres`/`postgres` — copying the old placeholder to
  run the API on the host against the compose DB failed auth (G5: code and docs must agree).
- Verified: `docker compose up --build --wait` returns only once `api` reports healthy;
  `docker compose ps` shows `api (healthy)`, db/adminer bound to `127.0.0.1` only, api on
  `0.0.0.0`/`[::]`; `DATABASE_URL` from the corrected `.env.example`, run from the host,
  connects (`prisma migrate status` → "Database schema is up to date!").

## 2026-08-08 — [SUG-OPS-007] Production API image (`apps/api/Dockerfile` `prod` target)

- `apps/api/Dockerfile` is now multi-stage: `base` → `dev` (unchanged behavior, compose pins
  `target: dev`) and `base` → `build` → `prod` (new). `prod`: compiled `dist/`, devDependencies
  stripped, pinned base digest, non-root `USER node`, `HEALTHCHECK`.
- **`pnpm deploy` and `pnpm prune --prod` both verified broken for this workspace and abandoned**
  (see the Dockerfile's own NOTE comment for the full story): `pnpm deploy`/`--legacy` copies
  `@repo/db`'s raw `.ts` source into `node_modules`, and Node 22 refuses to type-strip anything
  resolved from inside `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`) — confirmed by
  actually booting the container. `pnpm prune --prod` triggered an unexplained "reinstall from
  scratch" that dropped runtime deps (fastify, `@prisma/client`) while keeping root-only
  devDependencies (eslint, turbo) — reproduced twice, not a fluke.
- **What actually works:** install once with workspace symlinks kept (`@repo/db` resolves to
  `/app/packages/db/src/index.ts`, outside `node_modules` — type-stripping allowed there), generate
  + build, then explicitly `rm -rf` the known devDependency packages by name (both per-package
  top-level symlinks and their `.pnpm` store entries). 413M → 190M `node_modules`; final image
  817MB vs dev's 1.17GB.
- Verified end-to-end against local Postgres: `docker build --target prod`, container reaches
  Docker's own `HEALTHCHECK` "healthy" status, `/health` → 200, `/ready` → 200 (real DB round-trip),
  `/auth/otp/request` → 200 (real Prisma write). `docker compose up --build` (dev target,
  unchanged) still boots and serves `/health`.
- `security.yml`'s `trivy-api-image` job now builds `--target prod` (was building the dev image).
  Prod image cuts Trivy findings from 35 (33 HIGH/2 CRITICAL, dev image) to 23 (22 HIGH/1
  CRITICAL) — real, still-red, mostly transitive deps of Prisma's own tooling (`tar`, `nanoid`,
  `brace-expansion`, etc.) with upstream fixes not yet adopted in the lockfile. Left red on
  purpose — a `.trivyignore` waiver is for genuinely unfixed CVEs, not "haven't bumped yet";
  SUG-OPS-004 (next in this batch) wires Dependabot's npm ecosystem to chip away at this over time.
- `docs/STATUS.md` infra table updated.

## 2026-08-08 — [SUG-OPS-008] `apps/api/Dockerfile` uses the committed lockfile + pinned base digest

- `pnpm-lock.yaml` IS committed at repo root (the file's own stale comment said otherwise) — COPYed
  in and `pnpm install` now runs `--frozen-lockfile --filter @repo/db --filter @repo/api`, matching
  CI's own install step. Verified this doesn't need extra workspace manifests beyond `packages/db`
  and `apps/api` (`Scope: 2 of 3 workspace projects`, install succeeds) — the risk flagged in the
  suggestion's gotchas didn't materialize.
- `FROM node:22-slim` pinned to a resolved digest (`@sha256:d649c27d...`), tag kept alongside the
  digest for human readability and Dependabot's `docker` ecosystem (SUG-OPS-004, next in this batch).
- Verified: `docker build` succeeds; negative test — corrupted one dependency version in a scratch
  copy of `pnpm-lock.yaml` → build fails with pnpm's `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` (proves
  the flag bites), reverted cleanly. `docker compose up --build` (fresh volume) → API healthy,
  `curl localhost:3001/health` → `{"status":"ok"}` 200.

## 2026-08-08 — [SUG-OPS-011] AWS-portability lint (no Vercel APIs, no Neon-specific code)

- Added `scripts/portability-lint.mjs` (dependency-free — only `node:` built-ins + `git ls-files`):
  scans all tracked files under `apps/`, `packages/`, `tools/` (excluding `*.md`) for
  `@vercel/kv`/`@vercel/blob`/`@vercel/edge-config`, the Vercel KV REST hostname, `neon.tech`,
  `@neondatabase/serverless`, and `pg_embedding`. Prints `file:line: pattern` and exits 1 on any hit.
  Pattern list is a single exported const (`FORBIDDEN_PATTERNS`) for one-line additions.
- Added `scripts/portability-lint.test.mjs`: 15 table-driven `node:test` cases covering the matcher
  (`findViolations`) and the scan-path filter (`shouldScan`), following the `scope-guard.mjs`/
  `scope-guard.test.mjs` pattern already in this repo (pure exported functions, `main()` guarded by
  an `import.meta.url` check).
- Wired two new steps into `ci.yml`'s pre-install block (same slot as `render-agents.mjs --check`):
  the unit tests, then the lint itself.
- Verified: `node scripts/portability-lint.mjs` → PASS on the current tree (214 files scanned).
  Negative test: temporarily added `"@vercel/kv": "^1.0.0"` to `apps/api/package.json` → lint failed
  naming the exact file:line; reverted (`git status` confirms no residue).

## 2026-08-08 — [SUG-OPS-018] `prisma validate` is now a named, first-class CI gate
## 2026-08-08 — [SUG-DES-015] Fix stale owner link in design-system.md

- `docs/design-system.md`'s header named a nonexistent owner file (`agents/design-system-specialist.md`)
  — corrected to `agents/design-specialist.md` (`area:design`), the actual file that declares
  ownership of this doc. Bumped the "Last updated" date to reflect today's batch of edits.
- Sanity-swept the rest of the header's pointers per the suggestion's own audit — prototype link,
  tokens.json link, generator path all already correct, no other stale references found.
- Verified: `grep -rn "design-system-specialist" docs/ agents/ .github/ .claude/` → nothing;
  `test -f agents/design-specialist.md` → exists.

## 2026-08-08 — [SUG-OPS-018] `prisma validate` is now a named, first-class CI gate

- Added `db:validate` to `turbo.json`'s tasks (`{ "cache": false }`, mirrors `db:generate`) and a
  named `Prisma schema valid` step in `ci.yml` (`pnpm --filter @repo/db db:validate`) right after
  `pnpm install --frozen-lockfile`, using the job's real Postgres service `DATABASE_URL` rather than
  a dummy value. Verified locally: `prisma validate` → "The schema at prisma/schema.prisma is valid".
  Previously a broken schema was only caught indirectly via `db:generate` failing as a `typecheck`/
  `test` dependency — same protection, but now a named, unambiguous failure point.
- **Deliberately did NOT wire `openapi:check`** — it's still an `echo ... && exit 0` stub
  (`apps/api/package.json`), owned by backend (area:api). Wiring it would be an always-green placebo
  check, worse than no gate. Filed #23 asking backend to implement it for real; CI wiring is a
  one-line devops follow-up once it is.
- **Not implemented** (per the suggestion's own scope note): "clean migration apply on a fresh
  branch" — blocked on nothing beyond what SUG-OPS-013 already covers (`prisma migrate deploy`
  against the CI Postgres service already runs on every CI job); a dedicated fresh-branch/shadow-DB
  drift check (`prisma migrate diff --exit-code`) remains a possible stronger follow-up, not built here.

## 2026-08-08 — [SUG-DES-014] Off-token colors in the prototype fixed

- `#4A5170` (carte illustration depth-cue node) demoted (option 1(b)) rather than promoted to a new
  token: forensics showed it equals the *old* `ombre` (`#6A7194`) alpha-blended at `.65` over `nuit`
  almost exactly — it's a dimmed variant of the "en pause" legend state, not a new taxonomy category.
  Now `fill="#8A91B5" opacity=".65"` (current `ombre`), consistent with the file's own convention of
  literal hex + `opacity` attribute in SVGs (no `var()` used in `fill=` anywhere in this file).
- **Self-caught while fixing the above:** the carte SVG's two "en pause" legend nodes
  (`(238,60)`/`(66,160)`) had `fill="#6A7194"` hardcoded — the *pre*-SUG-DES-002 `ombre` value. Since
  SVG `fill` attributes here are literal hex, not `var(--ombre)`, SUG-DES-002's `:root` edit never
  reached them, leaving them visibly inconsistent with the legend swatch next to "en pause" (which
  uses `color:var(--ombre)` and did update). Fixed to `#8A91B5` in this same commit.
- `#05070F` (device shell / Dynamic Island): no token added — documented as intentional presentation
  chrome in `docs/design-system.md` §3's device-frame bullet.
- Verified: full lowercase hex inventory of the prototype (`grep -o "#[0-9a-fA-F]{6}"`, sorted/uniq)
  now matches `tokens.json` color values exactly, plus the one documented `#05070f` chrome exception.
  `generate.mjs --check` green (no token change this round).

## 2026-08-08 — [SUG-OPS-009] Turborepo cache persisted in CI + cache-hit job summary

- `ci.yml`: `actions/cache` step (keyed `turbo-${{ runner.os }}-${{ github.sha }}`, prefix
  `restore-keys`) persists `.turbo/cache` across runs, placed after `pnpm install` and before the
  turbo step. The turbo invocation now passes `--cache-dir=.turbo/cache --summarize` explicitly.
- Replaced the old placeholder job-summary line with a real cache-hit readout: parses the latest
  `.turbo/runs/*.json` (turbo's `--summarize` output) and appends `- turbo cache: N/M tasks hit` to
  `$GITHUB_STEP_SUMMARY`. Used `find ... -print -quit` instead of `ls -t | head -1` — `actionlint`
  (shellcheck SC2012) flagged the `ls` form.
- Verified locally against the real local Postgres (`docker compose up -d db`): cold run → `0/10
  cached`; immediate re-run → `9/10 cached` (only `db:generate` is `cache: false`, correctly not
  cached — Prisma client generation must always run against the current schema).
- Deferred (per the suggestion's own step 5, noted as a follow-up, not implemented here): affected-only
  `--filter="...[origin/main]"` execution. Skipped for the same reason the suggestion gives — 3 JS
  packages today, small win — and left as a documented future step rather than added speculatively.

## 2026-08-08 — [SUG-DES-013] De-duplicate the consolidated prototype (Option A: pointer stub)

- `blueprints/swab-app-prototype.html` and `docs/design/swab-prototype-consolidated.html` were
  byte-identical (verified MD5 match before this change) with nothing guarding it — a first edit to
  only one would have silently drifted, contradicting the "prototype/token contract/Penpot/blueprints
  never tell different stories" rule.
- Replaced `blueprints/swab-app-prototype.html`'s content with a small Nuit-styled pointer stub
  ("Moved — normative at `docs/design/swab-prototype-consolidated.html`"), kept under its original
  filename so existing links/previews don't 404.
- Amended `agents/design-specialist.md`'s blueprint rule: "one file per flow; the consolidated
  prototype lives at `docs/design/swab-prototype-consolidated.html`" (dropped "plus a consolidated
  prototype file", which institutionalized the copy); re-ran `node scripts/render-agents.mjs` —
  only `.github/instructions/design.instructions.md` needed re-rendering (`.claude/agents/` is a thin
  `@`-import wrapper, no duplicated content to update). `--check` green.
- Verified: only one path (`docs/design/swab-prototype-consolidated.html`) is now cited as normative
  across `agents/design-specialist.md`, `docs/design-system.md`, and `tokens.json`'s `meta.rule`.

## 2026-08-08 — [SUG-OPS-003] gitleaks + Trivy scanning wired into CI (`security.yml`)

- New `.github/workflows/security.yml`: `gitleaks` job (full-history scan, `fetch-depth: 0`) and a
  path-filtered `trivy-api-image` job (same zero-new-action `changes`-job diff pattern as `ci.yml`'s
  own path filter, scoped to `apps/api/**`, `packages/db/**`, lockfile/workspace manifests).
- Added `.gitleaks.toml`: allowlists 10 verified non-secret findings surfaced by a real local scan
  (`docker run zricethezav/gitleaks detect --redact -v`) — vault test-vector fixtures, a stable
  Keychain key-store-ID constant, and a fixed test-only `JWT_SECRET` literal in `apps/api/tests/helpers.ts`.
  Allowlisted by path with comments, per hard constraint 1 ("never silently"); re-verified clean
  (`gitleaks detect` → "no leaks found") before landing.
- **Known red gate, by design of this batch's ordering:** built and scanned `swab-api:pr` locally
  (`docker build` + `aquasec/trivy image --severity HIGH,CRITICAL --ignore-unfixed`) against today's
  single-stage **dev** Dockerfile (installs devDependencies) → 35 findings (33 HIGH, 2 CRITICAL,
  mostly transitive `tar`/`pnpm` CVEs pulled in by dev tooling), exit code 1. SUG-OPS-007 (later in
  this batch) adds a `prod` build target and this workflow's build step must be repointed at
  `--target prod` then — noted as a TODO in that step, not fixed here per the given task order.
- `docs/STATUS.md` CI row updated.

## 2026-08-08 — [SUG-DES-001] Six pre-Nuit standalone blueprints flagged SUPERSEDED

- The six per-flow standalone blueprints (`blueprints/swab - {Carte des relations, Fiche contact, Flux
  envie et match, Onboarding, Paramètres modaux, Sous-groupes} (standalone)*.html`) still carry the
  retired brown/gold palette (`#16120D` etc.) and Hanken Grotesk — none of the Nuit tokens. They're
  normative inputs to `/speckit-specify`, so a reader could silently pick up the wrong charter.
- **Option A (per the suggestion's recommendation)**: prepended an HTML comment banner + a visible,
  fixed, high-z-index top-of-page notice to all six, pointing at
  `docs/design/swab-prototype-consolidated.html` + `docs/design-system.md` as the normative visual
  reference. Flow structure/copy is unchanged and may still be consulted; visual values may not.
- Did not re-skin (Option B): these are ~950 KB tool-exported bundles (embedded
  `__bundler_thumbnail`, data-URL fonts) — brittle to hand-edit, and each would need its own ≤400-line
  PR per G4. Files not deleted — copy/flow still feed specs.
- Verified: `grep -L "SUPERSEDED" blueprints/swab\ -\ *.html` returns nothing (all six carry the
  banner). `docs/STATUS.md` design row updated.

## 2026-08-08 — [SUG-DES-002] `ombre` text token changed to fix WCAG AA contrast failure

- `ombre` was `#6A7194` — 3.83:1 on `nuit`, 3.44:1 on `encre`, 2.99:1 on `voile`, 2.60:1 on `voile-2`
  (relative-luminance formula, independently re-verified before landing this — see PR/report), all
  below the charter's 4.5:1 AA floor, at sizes (11px `flab` labels, 11–12.5px meta/caption) that don't
  qualify for the large-text 3:1 relief.
- Changed to **`#8A91B5`**: 5.92:1 / 5.31:1 / 4.61:1 / 4.01:1 on `nuit`/`encre`/`voile`/`voile-2` —
  AA-passing on the three surfaces `ombre` is actually used on for text (screen/card/row backgrounds);
  `voile-2` (avatars, switch track) stays below AA, so a new usage rule in `docs/design-system.md` §1
  forbids `ombre` text on `voile-2` and names `brume` (4.87:1) as the floor there instead. Considered
  and rejected `#8289AD` (5.34/4.79/4.16/3.62 — fails on `voile` too, a real text surface).
- Propagated through the full chain in this commit: both prototype copies' `:root --ombre`
  (`docs/design/swab-prototype-consolidated.html` + `blueprints/swab-app-prototype.html`, still
  byte-identical pending SUG-DES-013), `docs/design-system.md` §1, `tokens.json`, then regenerated.
- French token name unchanged, only the hex value changed. `ombre` stays visibly dimmer than `brume`
  on every surface, preserving the secondary/tertiary text hierarchy.
- No app-code change needed — `apps/ios`/`apps/android` reference `DesignTokens.Color.ombre` and pick
  up the new value automatically; flagged for `area:ios`/`area:android` awareness in the PR.

## 2026-08-08 — [SUG-DES-008] Étoile accent tints tokenized

- Added `etoile-voile` (`#e4be6a` @ `.14`, chip/selected fill), `etoile-piste` (`.30`, switch-on
  track), `etoile-lueur` (`.05`, `nuit`'s radial gold glow) to `tokens.json` `color`, reusing the
  `hair`/`hair-fort` base-hex-plus-opacity shape the generators already handle. Values confirmed
  verbatim against `docs/design/swab-prototype-consolidated.html` (`rgba(228,190,106,.05|.14|.3)` at
  lines 20, 59, 151) — no generator change needed.
- French names follow the charter's name-by-role rule (`voile` = veil/fill, `piste` = track,
  `lueur` = glow), consistent with existing `voile`/`voile-2` naming.
- `docs/design-system.md` §1: `nuit`'s glow row now cites `etoile-lueur`; the old one-line "accent
  tints (derived)" prose became a proper token table with all three tints (closing the gap where
  `.05` existed in the prototype but nowhere in the contract).
- Verified: `generate.mjs --check` green; `tokens.css`/Swift/Kotlin all gained the three tokens +
  opacity constants (spot-checked).

## 2026-08-08 — [SUG-DES-007] Motion tokens added (screen transition, border/control transition, press scale)

- Added `tokens.json`'s `motion` section — `screenTransition` (280ms/4px/`ease`), `borderTransition`
  (150ms), `controlTransition` (200ms), `pressScale` (0.985), `reducedMotion` (`"disable-all"`) —
  extracted verbatim from `docs/design/swab-prototype-consolidated.html` (`animation:fade .28s ease`,
  `transform:scale(.985)`, `transition:border-color .15s`, switch's `transition:transform .2s,background .2s`,
  the `prefers-reduced-motion` kill-switch), not invented.
- Extended `generate.mjs` with a `motion` renderer for all four targets, following the `component`
  group pattern: nested groups (`screenTransition` etc.) and top-level scalars (`pressScale`,
  `reducedMotion`) both render; CSS strips the `Ms` suffix from property names and appends the unit
  to the value instead (`--motion-screen-transition-duration: 280ms;`).
- `docs/design-system.md` §4 now names the token paths instead of only prose numbers.
- `validate.mjs`'s `motion` allowlist (pre-added in SUG-DES-005) needed no further change.
- Verified: `generate.mjs --check` green; spot-checked all four generated files contain the constants
  with byte-matching values.

## 2026-08-08 — [SUG-DES-009] Spacing scale reconciled between design-system.md and tokens.json

- `docs/design-system.md:82` published `4 · 8 · 12 · 14 · 16 · 20 · 24`; `tokens.json` had
  `xs:4, s:8, sm:12, m:16, l:24, xl:32` — missing `14`/`20`, and an unsourced `32`
  (`grep -c "32px" docs/design/swab-prototype-consolidated.html` → 0, so dropped rather than blessed,
  per the SSOT's own "do not hand-invent" rule).
- New `spacing` keys: `xs:4, s:8, sm:12, m:14, ml:16, l:20, xl:24` — the clean rename (not the
  additive `m14`/`l20` fallback the suggestion allowed) since a repo-wide grep found zero app-code
  consumers of `DesignTokens.Spacing` today, making the rename free.
- Added `component.screen` token (`paddingTop:14, paddingHorizontal:20, paddingBottom:20`) for the
  charter's `14 20 20` screen content padding, previously prose-only.
- Regenerated all four outputs (`node packages/ui/scripts/generate.mjs`); `--check` green.
  `docs/design-system.md` §3 now cites the SSOT keys and the new component token name.
  `docs/STATUS.md` design row updated (spacing-scale gap closed; the separate 39-micro-spacing-value
  gap is unrelated and stays open).

## 2026-08-08 — [SUG-OPS-005] Pin all third-party GitHub Actions to commit SHAs

- Every `uses:` in `ci.yml` and `scope-guard.yml` (`actions/checkout`, `pnpm/action-setup`,
  `actions/setup-node`, `actions/setup-java`, `gradle/actions/setup-gradle`) now pins a full commit
  SHA with a trailing `# vX.Y.Z` comment, resolved at implementation time via `git ls-remote --tags`
  (annotated tags dereferenced with `^{}` to their commit, not the tag object).
- `pnpm/action-setup` and `gradle/actions` use annotated tags — pinned to the commit each tag's `^{}`
  deref points to, not the intermediate tag-object SHA GitHub's ref API returns on the first hop.
- Not changed: the docker-based `rhysd/actionlint:latest` step in `ci.yml` — that's a `docker run`
  image reference, not a `uses:` action, out of this suggestion's scope (SUG-OPS-005 covers Actions).
- Verification: `grep -E "uses:.*@v[0-9]" .github/workflows/*.yml` → empty. Dependabot's
  `github-actions` ecosystem (SUG-OPS-004, later in this batch) keeps the `# vX.Y.Z` comments in sync.

## 2026-08-08 — [SUG-DES-005] Input validation for the token generator

- Added `packages/ui/scripts/validate.mjs` (`validate(tokens)`, pure/no I/O) and wired it into
  `generate.mjs` right after `JSON.parse`, before any build/write: checks `meta` shape, an exact
  top-level key allowlist (`meta, color, typography, spacing, radius, component`, plus `motion` —
  pre-allowlisted for SUG-DES-007, landing next in this batch), hex color format, opacity in `(0,1)`,
  typography field types incl. a `family` allowlist (`Space Grotesk` | `Inter`, charter rule 5),
  positive spacing/radius, and component `*Token` references resolving to a real key. Violations
  collect into one `Error` with JSON-path-prefixed lines (e.g. `color.voile-2.value: ...`).
- On failure: `console.error` the full message, `process.exit(1)` — same in write and `--check` mode,
  before any file is touched.
- Added `packages/ui/scripts/generate.test.mjs` (`node:test`, no new dependency) covering bad hex,
  dangling ref, out-of-range opacity, missing size, unknown top-level key, disallowed family,
  negative spacing, invalid `textTransform`. `packages/ui/package.json`'s `test` script now runs
  `node --test scripts/generate.test.mjs` before the existing `--check` drift guard.
- Verified: 9/9 tests pass; valid `tokens.json` still regenerates byte-identical output
  (`generate.mjs --check` → "Design tokens up to date.").

## 2026-08-08 — [SUG-OPS-006] Named CI step for the design-token drift guard

- Added `node packages/ui/scripts/generate.mjs --check` as its own named step in `ci.yml`
  ("Design tokens in sync…"), right after the agent-render check and before `pnpm install` — same
  pre-install slot as `render-agents.mjs --check`, since the generator only imports `node:` built-ins
  (verified: runs clean with no `node_modules` present).
- Checked first per the task's own instruction: `packages/ui/package.json` already has a `test` script
  doing the same check (SUG-DES-003, landed earlier today) that `pnpm turbo run test` already exercises
  in the long turbo step further down. Added this step anyway, per SUG-OPS-006's own reasoning it's
  not redundant-therefore-skippable: a named, isolated step fails in seconds with an unambiguous
  message, well before the multi-minute turbo run gets anywhere near it.
- Verified locally: `node packages/ui/scripts/generate.mjs --check` → "Design tokens up to date.", exit 0.

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
