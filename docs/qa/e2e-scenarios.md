# E2E functional test scenarios — FS-01 / FS-02 / FS-03 / FS-07

One scenario per functional requirement of the implemented specs. Each scenario is the
executable contract behind the automated suites (`apps/ios/SwabAppUITests/`,
`apps/android/app/src/androidTest/.../e2e/`) and the coverage manifest
(`docs/qa/e2e-coverage.json`) that the report generator (`scripts/e2e-report.mjs`) joins
test results against.

**Verification classes** (used in the manifest, per platform):

| Class | Meaning |
|---|---|
| `automated` | Covered by a named on-device E2E test; the report FAILS if that test is missing from a run (drift guard). |
| `unit-covered` | Behavior verified by unit/integration tests in the platform test target (e.g. crypto vectors, wire-format assertions) — not driveable through the UI. |
| `api-integration` | Server-side requirement, verified by `apps/api` integration tests — no mobile UI surface. |
| `manual` | Requires human judgment (visual grammar, perf feel, screen-reader UX); scenario below is the checklist. |
| `not-e2e-verifiable` | No surface exists to verify it end-to-end today (e.g. out-of-POC-scope); the notes say why — never silently dropped. |

French UI copy in the steps is normative (quoted from the specs verbatim).

---

## FS-01 — Onboarding & Relationship Calibration

### ONB-01 — Welcome screen & privacy promise
- **Given** a fresh install (no local state),
- **When** the app launches,
- **Then** the welcome screen shows the brand (swab · صواب), the tagline, the privacy promise, and a single CTA « Commencer » — and no account exists server-side until it is tapped.
- Edge cases: relaunching before tapping « Commencer » must not create state.

### ONB-02 — Phone-OTP signup, vault key before classification
- **Given** the welcome screen acknowledged,
- **When** the user enters a phone number and the received OTP,
- **Then** signup succeeds (server sees only `phoneHash`, per IDT-01), and the device vault key is generated **before** any calibration screen can accept input.
- Edge cases: wrong OTP shows a recoverable error; navigating phone → OTP must not lose the entered number (Wave-1 regression: per-`composable{}` state loss).

### ONB-03 — Add contacts: import, manual, skip
- **Given** the signed-up user on « Qui compte pour toi ? »,
- **When** they choose « Importer mes contacts » (permission-gated), enter one manually, or tap « Passer »,
- **Then** all three paths proceed; skipping carries no penalty, no nag, and identical downstream capabilities.
- Edge cases: OS-level permission denial → manual path completes the flow with identical capabilities (spec acceptance criterion).

### ONB-04 — Radial calibration prefigures the map
- **Given** at least one added contact,
- **When** the user drags/taps the contact onto an intimacy ring around « moi »,
- **Then** the contact is assigned to that ring and the radial layout visually prefigures the FS-02 map.
- Edge cases: rings 3/4 currently blocked by the open CalibrateScreen text-wrap bug — suites intentionally hard-fail if driven there (guard, not coverage).

### ONB-05 — Classification never leaves the device
- **Given** onboarding in progress with calibration/état/ressenti input,
- **When** all network traffic during onboarding is inspected,
- **Then** zero classification data (rings, rôles, état, ressenti) appears in any request; the only classification-adjacent call is `POST /vault` with an opaque encrypted blob.
- Verification note: asserted at the wire level in unit/integration tests (network mock), not driveable from the UI layer.

### ONB-06 — État/Ressenti layer optional and collapsed
- **Given** the calibration step,
- **When** the user never expands the état/ressenti layer,
- **Then** it stays collapsed by default and onboarding completes without it.

### ONB-07 — Completion screen → carte
- **Given** calibration finished,
- **When** the completion screen appears,
- **Then** it confirms privacy (« Personne — ni eux, ni nous… ») and « Voir ma carte » lands on the FS-02 map.

### ONB-08 — Onboarding resumable mid-flow
- **Given** onboarding interrupted (process death / activity recreation / relaunch) at any step,
- **When** the app is reopened,
- **Then** the flow resumes at the same step from local state — no restart from zero.

### ONB-09 — No gamification
- **Given** every onboarding screen,
- **When** inspected,
- **Then** there is no progress percentage, no confetti, no "X contacts added!" counter; step indication is positional only.

## FS-02 — Relationship Map (Carte des relations)

### MAP-01 — Radial layout from the vault
- **Given** a completed onboarding with calibrated contacts,
- **When** the map opens,
- **Then** « moi » is centered and every contact renders on the ring chosen during calibration, with no server call needed to render.

### MAP-02 — Exactly three nav destinations, no badges
- **Given** the map screen,
- **When** the primary navigation is inspected,
- **Then** it exposes exactly Carte, Envie, Sous-groupes — and no badge or unread counter on any nav item.

### MAP-03 — Non-textual axis encoding
- **Given** contacts with differing état,
- **When** viewed on the map,
- **Then** ring distance encodes intimité and the état variant follows the blueprint's A·chaud / B·froid visual treatments.
- Verification note: visual grammar — human judgment against the blueprint.

### MAP-04 — Tap → « Ouvrir la fiche » → FS-03
- **Given** a placed contact,
- **When** the user taps it,
- **Then** the peek sheet shows the correct rows with « Ouvrir la fiche » enabled, and opening it transitions to the fiche with spatial continuity (grows from map position).
- Edge cases: regression guard for the Wave-2→3 disabled « Ouvrir la fiche » button.

### MAP-05 — Offline-first, first paint < 500 ms
- **Given** airplane mode and a calibrated vault,
- **When** the app cold-starts,
- **Then** the map is fully interactive with zero failed-request UI, first paint from local data under 500 ms on mid-range hardware.
- Verification note: offline interactivity is automatable; the 500 ms budget is a manual/profiled check.

### MAP-06 — Calm empty/sparse states
- **Given** onboarding completed with zero (or few) contacts,
- **When** the map opens,
- **Then** the empty state invites adding people without alarm, urgency, or progress framing.

### MAP-07 — ~150 contacts without jank
- **Given** ~150 calibrated contacts,
- **When** panning/zooming,
- **Then** rendering stays at 60 fps and denser rings cluster gracefully.
- Verification note: perf/visual — manual with profiling tools; clustering design still open (OQ-MAP-1).

### MAP-08 — Screen-reader list fallback
- **Given** list mode,
- **When** navigating,
- **Then** contacts are grouped by intimacy ring and each entry opens the same fiche (feature parity); with VoiceOver/TalkBack every contact is reachable and announces name + ring.
- Verification note: grouping/parity is automated; assistive-tech UX itself is manual.

### MAP-09 — No search, no ranking
- **Given** the map and list surfaces,
- **When** inspected,
- **Then** there is no global search field, no sorting metric, no "top friends" — discovery is spatial only.

## FS-03 — Contact Card (Fiche contact)

### FCH-01 — Four axes tap-editable, vault-write + history event
- **Given** an open fiche,
- **When** the user edits any of the four axes (Intimité, Rôles·contexte, État, Ressenti),
- **Then** the change persists immediately (optimistic, offline-capable), survives leaving and reopening the fiche, and appends a local history event.

### FCH-02 — Asymmetric, private classification
- **Given** any fiche,
- **When** its full content and copy are reviewed,
- **Then** nothing reflects how the other person classified the user, and no copy implies symmetry.
- Verification note: copy review — human judgment.

### FCH-03 — No counters or metrics on the fiche
- **Given** any fiche,
- **When** inspected,
- **Then** any reciprocity signal is qualitative, never numeric; « Aucun compteur, aucune métrique » anywhere on the fiche. (Both platforms currently show no reciprocity signal at all — the converged Wave-3 interpretation.)

### FCH-04 — History feed, newest first, vault-sourced
- **Given** a fiche with at least one past axis edit,
- **When** the history feed is read,
- **Then** it shows axis changes (and coarse-grain match events) over 12 months, newest first, sourced from the vault only.

### FCH-05 — Staleness nudge, discreet, two actions
- **Given** a relation with no axis change for the staleness period (default 6 months),
- **When** the fiche opens,
- **Then** a discreet, non-modal, non-blocking prompt offers exactly « C'est toujours ça » (re-confirms, resets timer) and « À revoir plus tard » (dismisses quietly, re-eligible after 30 days); nothing is logged server-side.
- Verification note: requires clock manipulation — covered at the unit level (staleness logic), not driveable end-to-end without a time-travel hook.

### FCH-06 — « en pause » état + filter consequence
- **Given** a contact whose état is « en pause »,
- **When** the fiche renders,
- **Then** the état vocabulary includes « en pause » and the fiche shows the FS-06 filter consequence for the current état (e.g. « en pause → exclu par défaut à l'envoi »).
- Edge cases: the état-vs-ressenti axis ambiguity for « en pause » is flagged in Wave 3 — both axes checked until resolved.

### FCH-07 — Back to map preserves position
- **Given** a fiche opened from the map,
- **When** the user navigates back,
- **Then** the map is restored at the same position (MAP-04 reverse transition) and any ring change is reflected with an animated, not teleported, move.

### FCH-08 — Fiche for non-member contacts
- **Given** a manually added contact who hasn't joined Swab (`ContactLink.targetId = null`),
- **When** their fiche opens,
- **Then** all four axes are fully editable and envie eligibility is clearly indicated as inactive until they join.

## FS-07 — Identity, Contacts & Vault Sync

### IDT-01 — Phone-OTP identity, phoneHash only
- **Given** the signup flow,
- **When** a phone number + OTP round-trip completes,
- **Then** authentication succeeds and the server stores only the client-side salted `phoneHash`, never the raw E.164 number.
- Verification note: the mobile-side flow is automated via onboarding; the storage guarantee is an API/DB integration assertion.

### IDT-02 — JWT access + rotating refresh, reuse detection
- Server-session behavior (rotation, family revocation on refresh reuse) — `api-integration`; no mobile UI surface.

### IDT-03 — OTP throttling, single-use, ≤ 5 min
- Server rate-limit behavior per phoneHash/IP — `api-integration`; deliberately not driveable from a mobile E2E (would require abusive request volume from a device).

### IDT-04 — Account deletion, cascade erasure, 7-day grace
- **Given** an account with data,
- **When** in-app deletion is triggered,
- **Then** full cascade erasure follows (irreversible after 7-day grace) and the phoneHash can re-register fresh.
- Verification note: no native deletion UI exists yet (not part of Waves 1–3 scope); cascade behavior is an API integration test. Mobile E2E pending that UI.

### IDT-05 — Multi-device / recovery phrase
- Out of POC scope by spec (new device = re-import via backup phrase, assumption) — `not-e2e-verifiable` until designed.

### IDT-06 — Hashed contact discovery
- **Given** contact import,
- **When** contacts are submitted for discovery,
- **Then** numbers are hashed locally before transmission and the response reveals nothing beyond the membership boolean.
- Verification note: hashing-before-network is unit/wire covered; response-shape guarantees are API tests. The import UI path itself is exercised by the onboarding E2E.

### IDT-07 — Invite non-members, pending links resolve on join
- Web landing + link resolution — web/backend scope (`api-integration` + web tests); the mobile-side "non-member contact exists with editable fiche" half is FCH-08.

### IDT-08 — Directional, private links
- « No "X added you" notifications, ever » — absence of a notification is asserted server-side (no such event/payload exists) — `api-integration`.

### IDT-09 — Opaque invite tokens
- Web landing behavior — web scope, `not-e2e-verifiable` from mobile.

### VLT-01 — Vault encrypted on-device (AES-256-GCM)
- **Given** any classification write,
- **When** the stored artifact is inspected,
- **Then** it is AES-256-GCM ciphertext with the key held in the platform secure store (Keychain / Keystore).
- Verification note: covered by crypto unit tests + cross-platform vectors (`docs/migration/vault-test-vectors.json`); the E2E suites exercise the real path implicitly (legacy-blob seed hooks write through real crypto).

### VLT-02 — Dumb blob storage, optimistic concurrency
- `GET/POST /vault` blob + version semantics, 409 on stale — `api-integration` + client unit tests.

### VLT-03 — Server never decodes the blob
- Privacy invariant at the wire/server level — `api-integration` (the wire-level privacy test), re-verified on every schema change.

### VLT-04 — Sync triggers, offline between syncs
- **Given** vault writes,
- **When** the app backgrounds / finishes onboarding / bursts writes,
- **Then** sync fires (debounced ≥ 30 s) and the app remains fully functional offline between syncs.
- Verification note: trigger scheduling is unit-covered; the offline-functionality half is exercised by the map/fiche E2E flows against local state.

### VLT-05 — Device loss honesty
- **Given** the surface where vault backup is explained,
- **Then** the app states honestly that losing the device without the recovery phrase loses classification data.
- Verification note: recovery-phrase UX is an open question (OQ-IDT-2); no such screen exists yet — `not-e2e-verifiable` until it does.

---

## Regression scenarios (past bugs — permanent guards)

| Guard | Origin | Automated test |
|---|---|---|
| Phone → OTP navigation must not lose entered state | Wave 1 (`remember` per `composable{}`) | Android `test_navigationStateLoss_phoneHashSurvivesPhoneToOtpTransition` |
| Map node size must not collapse on high-density screens | Wave 2 (`Float.toDp()` double conversion) | Android `test_densityRegression_placedNodeSizeIsNotCollapsed` |
| « Ouvrir la fiche » must be enabled in the peek sheet | Wave 2→3 regression | both platforms' MAP-04 tests |
| Pre-FS-03 vault blob must load without crash | Wave 3 vault shape change | both platforms' legacy-vault backward-compat tests |
