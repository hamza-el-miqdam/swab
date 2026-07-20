# Changelog — repo root (area:devops · docs · agents · design · specs · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, design, specs, scripts, workspace config.
> Per-area history: [apps/ios](apps/ios/CHANGELOG.md) · [apps/android](apps/android/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets, ≤ ~15 lines per entry (G5). Updating the right changelog is part of every Definition of Done.

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
