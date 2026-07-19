# Changelog — repo root (area:devops · docs · agents · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, scripts, workspace config.
> Per-area history: [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets. Agents: updating the right changelog is part of your Definition of Done (G4.7).

## 2026-07-19 — chore: remove frozen apps/mobile RN reference implementation

- `apps/mobile` was the Expo/React Native reference during the native migration to `apps/ios` and `apps/android`. Native implementations (Waves 1–4) reached parity and are feature-complete; knowledge is preserved in `docs/migration/rn-native-handoff.md`, `docs/migration/vault-test-vectors.json`, and `docs/migration/rn-audit-map.md`.
- Deleted `apps/mobile` folder entirely.
- Updated `agents/_global-directives.md` to remove `apps/mobile` from the project description and from the G5 changelog locations.
- Updated `agents/design-specialist.md` to remove `apps/mobile` from scope and update token-consumption guidance.
- Updated `agents/ios-specialist.md` and `agents/android-specialist.md` to remove the frozen-reference scope restriction and update feature-parity references to point to specs + handoff docs.
- Removed reference link in root `CHANGELOG.md` per-area history.
- Updated `docs/STATUS.md` to remove `apps/mobile` from the modules table and the Changelogs section.

## 2026-07-12 — [area:design] Split "Mariages & naissances" into two rows on the Paramètres screen

- **What:** on the Settings screen (`22 · Paramètres`), the single "Mariages & naissances" event-
  notification row is split into two independent rows — "Mariages" and "Naissances" — each with its
  own toggle. Applied in three places kept in sync: the Penpot prototype ("Prototype — Parcours
  consolidé" page, board `22 · Paramètres`), the consolidated prototype
  (`docs/design/swab-prototype-consolidated.html`), and the blueprint
  (`blueprints/swab-app-prototype.html`).
- **Why:** weddings and births are distinct life events; users should be able to mute one without the
  other. Requested product refinement.
- **How (Penpot):** cloned the existing "Mariages & naissances" `switchrow` (its `lbl` + `sw` toggle
  sub-boards) so the new "Naissances" row is byte-identical in style/toggle default (checked/on) — no
  values reinvented. The section lives inside the `content` flex-column (rowGap 14), so insertion +
  ordering (Anniversaires → Mariages → Naissances → Deuils) is layout-driven; no manual repositioning.
  The frozen "Deuils" row (with its "toujours en registre sobre" sub-text) and everything below simply
  reflow down 35px. `content` is a fixed-height (734) flex board but content only reaches y+634 of it,
  so the extra row fits with slack — re-verified zero overflow (content bottom = safe-area bottom) and
  `export_shape`-confirmed the four rows render correctly.
- **Gotcha:** `shape.clone()` inserts the copy adjacent to the original at an unpredictable sibling
  index, and the flex reflow is async — always re-read child order after cloning and fix ordering with
  `setParentIndex`, then `await` ~300ms before reading positions or the container looks un-reflowed
  (rows appear to overlap at the same y).
- **Follow-up:** copy ("Mariages", "Naissances") is a prototype-level refinement; if a settings spec
  freezes this list it must match. No token/component changes; no app code touched (hand-off to
  `area:ios`/`area:android` when the native settings screen is built).

## 2026-07-17 — [area:design] Penpot native Flows wired — prototype is now Play/Present-able

- **Context:** all click interactions on the "Prototype — Parcours consolidé" page were already
  wired from prior sessions, but Penpot's Present/Play mode picks its start point from `page.flows`
  (`Flow` objects with a named `startingBoard`), not from click wiring. Before this pass, all 5
  existing `page.flows` entries pointed at the organizational `Flow N · <Title>` wrapper board (a
  ~3600×1000pt row containing every screen in that section side-by-side) instead of an actual
  418×890pt phone screen, and there was no Flow at all for the true app entry point
  `1 · Bienvenue` — so Play mode had nothing usable to open on.
- **Repointed the 5 pre-existing Flows** from wrapper boards to real screen boards (`startingBoard`
  reassigned directly, flows not deleted/recreated): `Flow 2` → `6 · Carte des relations`,
  `Flow 3` → `8 · Sous-groupes`, `Flow 4` → `10 · Envie · émission`, `Flow 5` → `13 · Événements`,
  `Flow 6` (previously named/targeting `Flow 8 · Générosité`) → `23 · Envies de recevoir`.
- **Created `"0 · Parcours complet"`** starting at `1 · Bienvenue` — the actual main-path entry
  point, previously missing.
- **Created 10 more Flows, one per orphan-cluster local root**, so the 14 alternate-take/variant
  screens (mostly the `N · Claude · ...` set) that the BFS from `1 · Bienvenue` doesn't reach stay
  individually selectable in the Play dropdown without being merged into the main path (explicit
  user instruction — these are deliberate alternates, not missing main-path steps): `Authentification
  — retour` (`6 · Bon retour`), `Auth — email seul (variante)` (`5 · Claude · email seul`), `Carte
  des relations — variante foyer` (`6 · Claude · carte foyer`), `Fiche contact` (`7 · Fiche
  contact`), `Envie — variante émission Claude` (`10 · Claude · émission`), `Envie — variante 1:1`
  (`10 bis · Claude · envie 1:1`), `Envie — variante émission v2` (`10 ter · Claude · émission
  v2`), `Coïncidence — variante Claude` (`12 · Claude · coïncidence`), `Coïncidence — frôlement →
  accordage` (`12 bis · Claude · frôlement` — chains into the already-wired `12 ter · Claude ·
  accordage`, no separate flow needed for that screen), `Événement — variante deuil` (`16 · Claude
  · deuil`). **16 `page.flows` entries total**, every one verified pointing at a real 418×890
  screen board (never a wrapper) by re-reading `startingBoard.width`/`.height` after each write.
- **Fixed 3 stale click-wiring bugs** found while tracing the flows for playability (confident
  inferences from cluster-internal logic, flagged for the user to override if wrong):
  - `3 · Code de vérification`'s `Text` click interaction went to `4 · Onboarding · terminé`
    (several screens past where OTP verification should land — a stale leftover from before
    `Flow 0 · Authentification` was restructured in) — repointed to `6 · Bon retour`, which
    previously had zero inbound clicks. Fixes both problems in one move.
  - `23 · Envies de recevoir`'s 3 `rowi` list rows pointed to `9 · Sous-groupe · détail` (a
    cross-flow copy-paste artifact flagged in a prior session, never fixed) — repointed to
    `24 · Offrir · pioche scellée`.
  - `24 · Offrir · pioche scellée`'s button pointed to `19 · Événement · paiement` — repointed to
    `25 · Réception`, so the Générosité flow now completes end-to-end.
  - Mutation mechanics: reassigning `flow.startingBoard = <Board>` directly works for Flows. For
    interactions there's no destination-reassign method — had to read the interaction's `trigger`,
    call `.remove()` on the stale one, then `shape.addInteraction(trigger, { type: "navigate-to",
    destination: <newBoard> })` to recreate it.
- **Verified before/after:** BFS over the click graph from `1 · Bienvenue` reached 25 screens
  before this pass and 26 after — the +1 (`6 · Bon retour`) is the direct, intended effect of the
  `3 · Code de vérification` fix, confirming the wiring fixes didn't accidentally leak the 14
  intentionally-separate orphan screens into the main path. `export_shape` spot-checks of
  `1 · Bienvenue`, `13 · Événements`, and `23 · Envies de recevoir` (three different Flow starting
  boards) all confirmed genuine single phone screens, not malformed/oversized boards.
- **Gotcha for future sessions:** Penpot's Play/Present mode reads `page.flows`, entirely separate
  from click-wiring health — a page can have perfect `NavigateTo` wiring end to end and still be
  unplayable if no Flow points at a real screen. Check both when auditing prototype playability.

## 2026-07-17 — [area:design] Penpot prototype click-walkability pass — 7 interactions wired, non-nav gaps confirmed deliberate

- **Context:** the "Prototype — Parcours consolidé" Penpot page currently holds 33 screens across
  9 flows (STATUS.md's previous 22/7 figures were stale — corrected in the same edit as this entry).
  A prior session's live query found a set of screens with zero or partial `NavigateTo` click
  interactions; this pass worked through that gap list against `blueprints/swab-app-prototype.html`'s
  `show()` navigation graph (the source of truth where a Penpot screen has an HTML equivalent) and,
  for the `N · Claude · ...` variant screens and all of `Flow 8 · Générosité` (no HTML equivalent),
  against each screen's own visible copy read via `export_shape`/structure dump.
- **Wired (7 new `click → navigate-to` interactions, verified by reading `action.destination.name`
  back after writing, plus two `export_shape` visual spot-checks):**
  - `6 · Claude · carte foyer` Button "+ Nouvelle envie" → `10 · Envie · émission` (inferred from
    its wired sibling `6 · Carte des relations`, whose own "+ Nouvelle envie" tile targets the same
    screen).
  - `23 · Envies de recevoir` Button "Sceller une envie de recevoir" → `24 · Offrir · pioche scellée`
    (Flow 8's own screen order, no HTML equivalent to check against; documented as a click-walkthrough
    continuity choice — in the real product these three screens are three different people's
    perspectives, not one person's linear path, but the prototype needs a forward click somewhere).
  - `18 · Événement · budget`, all 4 `rowi` gift rows (Livre, Chocolats, Fleurs, Coffret gourmand) →
    `19 · Événement · paiement`, in addition to the screen's own "Suivant" Button which already
    targeted the same destination. In the HTML these rows only *select* (`evPick()`, local state,
    committed by a separate "Suivant" click); wiring them directly was an explicit instruction for
    this pass rather than something independently derived from the HTML's non-nav pattern — flagging
    that provenance here in case it's reconsidered later.
  - `12 bis · Claude · frôlement` Button "S'accorder" → `12 ter · Claude · accordage` (strong copy
    match: 12 bis's CTA literally means "get in sync," 12 ter is titled "accordage" — tuning/syncing —
    and shows the resulting negotiation thread).
- **Confirmed correctly left unwired (no HTML/copy support for navigation — local UI state, per the
  no-forced-nav rule):** `16 · Événement · répondre` "Ne rien faire", `16 · Claude · deuil` "Plus
  tard", `17 · Événement · message` "Envoyer le message", `21 · Attention reçue` both buttons,
  `22 · Paramètres` "Exporter mes données" + the "Quitter SWAB" text, `14 · Événement · déclarer`'s
  switchrow, `25 · Réception` both buttons (copy is near-verbatim `21 · Attention reçue`, itself
  confirmed non-nav), `12 · Coïncidence` "Proposer" (matches the HTML's `proposeMeet()`, a same-screen
  state toggle, not a screen change), `12 · Claude · coïncidence` both buttons, `12 bis`'s "Laisser
  passer", `12 ter`'s "Passer cette fois" (all share the established silent-decline pattern). Also
  re-confirmed: `3 · Onboarding · calibration`'s CTA was already wired to `4 · Onboarding · terminé`
  going into this session (someone/something fixed it before this pass started), and `6 · Carte des
  relations`'s `tilegrid`/`tilerow` "unwired" containers are false positives — their child tiles
  already carry the real interactions.
- **Flagged, not guessed — needs the user's call:** `12 ter · Claude · accordage` Button "Confirmer
  samedi 11h" has no HTML equivalent and no copy that names a destination; the plausible inference
  (return to the `6 · Carte des relations` hub, matching every other terminal `donehead` screen in
  the file) felt too speculative to commit without confirmation, so it was left unwired rather than
  fabricated.
- **Also noticed, out of this pass's scope, not touched:** `23 · Envies de recevoir`'s 3 `rowi` rows
  are each wired to `9 · Sous-groupe · détail`, which looks like a copy-paste artifact unrelated to
  this screen's content (recevoir-wish rows, not a subgroup list) — flagging for a follow-up, not
  fixed here since it wasn't part of the assigned gap list and a wrong guess at the "correct" target
  seemed worse than leaving the existing (likely wrong) wiring alone pending the user's input.
- **Gotcha:** total on-page interaction count read back as 59 after this pass, not the expected
  50 (pre-existing) + 7 (this pass) = 57 — the page was flagged as possibly being edited live by
  someone else this session, so the discrepancy is noted but not chased down.
>>>>>>> 1e1b35b (chore(mobile): remove frozen RN reference implementation)

## 2026-07-12 — [area:design] Flow 0 follow-up: simplified Bienvenue, new optional "Vos coordonnées" screen

- **What (Change 1 — simplify `1 · Bienvenue`):** removed the "paycard"-style cohort info block
  (résidence name, synced-entry date, expected-member count) from the Bienvenue screen — the app
  has no such address/cohort data about the user at this point in the flow (phone auth hasn't even
  run yet), so displaying it implied information that isn't true. Replaced with a plain, calm
  welcome: one tagline ("Bienvenue. Prenez votre temps.") + one short reassurance sentence ("Rien
  ne se passe tant que vous ne l'avez pas décidé — pas de compte à rattraper, pas d'attente, juste
  votre carte quand vous serez prêt·e."), per product law 5 (calm by design — nothing fabricated or
  implied that isn't true yet). Single primary CTA kept, renamed "Commencer" (from "Rejoindre ma
  communauté" — the old copy referenced the removed cohort framing); its destination was
  re-verified unchanged: `-> 2 · Numéro de téléphone`.
- **What (Change 2 — new screen `5 · Vos coordonnées`):** inserted between `4 · Votre nom` and the
  existing `5 · Bon retour`, which is renumbered `6 · Bon retour` (same board, no other flow
  touched — Flows 1–7's own numbering/IDs untouched). Two optional fields, **Adresse** (postal
  address — "for receiving physical things from friends, gifts, event mail") and **Email** ("for
  the case where someone doesn't want app-mediated delivery but still wants to be reachable"), both
  reusing the existing Text field component built last session for `auth-tel`/`auth-nom` — no new
  component added. Copy: title "Vos coordonnées", subtitle "Facultatif. Vous pouvez continuer sans
  rien renseigner, et revenir dessus plus tard.", field placeholders "Adresse postale" /
  "adresse@email.com" (kept short to fit the field's fixed width — the "why" lives in the note
  below the fields instead, matching the `auth-tel` pattern of short placeholder + explanatory
  note), note "Utile si un·e proche veut vous envoyer un cadeau ou un mot. Jamais montré à vos
  contacts, jamais requis pour utiliser SWAB." Single CTA "Continuer", always enabled — works
  identically whether either field is filled or empty, so there is no separate skip affordance:
  this keeps to the "one étoile primary action per screen" rule while producing the exact same
  non-blocking effect as the "Passer" precedent on ONB-03 (skippable contact import) / ONB-06
  (optional état-ressenti layer) — optional layers never block completion. Rewired:
  `4 · Votre nom -> 5 · Vos coordonnées -> 1 · Onboarding · clés` (the same target `4 · Votre nom`
  used to navigate to directly); `6 · Bon retour`'s own routing (`-> 6 · Carte des relations`,
  short-circuit for returning users fed from the OTP branch) is untouched.
- **Unspec'd surface, flagged not frozen:** neither field exists in any of `docs/specs/FS-*.md`,
  `docs/product-overview.md`, or `swab-domain-spec.md` (zero hits checked for "adresse"/"email" as
  a contact-info concept before starting). All copy on both screens is proposed, not sourced — HTML
  comments in both prototype sources mark it as such. **This introduces two candidate `User` fields
  (postal address, email) with no schema/vault placement decided — needs an `area:db` proposal
  before any backend/app work can support it; not proposed here, out of this agent's scope.**
- **Privacy judgement call (flagged, not redesigned):** a postal address isn't classification data
  (rôles/intimité/présence/état — the G1 privacy invariant's specific scope), so it doesn't
  literally violate that invariant. It's still sensitive PII with no established
  encryption/storage story in this app the way phone number and vault contents have — worth the
  data-steward's explicit attention on where/how it's stored (`Vault` blob vs. a plain `User`
  column) when the `area:db` proposal is opened. No defensive redesign attempted here — one-line
  flag only, per this task's scope.
- **Verification:** both prototype HTML sources (`docs/design/swab-prototype-consolidated.html`,
  `blueprints/swab-app-prototype.html`) kept byte-identical after edits (`diff` clean). Penpot:
  cloned `4 · Votre nom` as the structural base for the new screen (reuses the Text field
  component's `field / nom` board verbatim, renamed `field / adresse` + a cloned `field / email`),
  fixed a flex-reflow stall after board insertion (toggling `columnGap` forced Penpot to recompute
  child x-positions — see gotcha below), fixed a text z-order/insert quirk on the Bienvenue tagline
  (`content.insertChild(i, shape)` silently no-ops when the shape is already a child of that same
  parent — use `shape.setParentIndex(i)` instead to reorder within an existing parent). Flow 0
  re-checked for zero pairwise overlap and zero containment violations after the insert+renumber
  (6/6 screens, `isContainedIn` against the flow board); re-checked page-wide for zero overlap
  across all 8 flow boards (Flow 0 grew from 5 to 6 screens, width 3084px, still clear of Flow 1 by
  ~258px). `export_shape`-verified `1 · Bienvenue` and `5 · Vos coordonnées` individually, plus the
  full `Flow 0 · Authentification` board (all 6 screens at once, confirming numbering 1–6 in both
  board names and their internal topbar-title text — these are two separate values in Penpot, easy
  to update one and miss the other, which happened once mid-session and was caught by the full-board
  export before finishing).
- **Gotcha for next agent:** (1) `content.insertChild(index, shape)` where `shape` already belongs
  to `content` does not reorder it — it silently fails (no error, no move). Use
  `shape.setParentIndex(index)` for in-place reordering. (2) After inserting a new child into an
  existing flex-row board (e.g. adding a 6th screen to a 5-screen "Écrans" row), sibling positions
  do not always auto-reflow immediately even after an `await sleep`; nudging any flex property (e.g.
  `columnGap += 1` then back) forces Penpot to recompute — found via stale/overlapping x-positions
  on export. (3) Every screen has its `N · Titre` in *two* places — the board's `.name` and a
  separate Text shape inside `topbar` with the same string as its `characters` — renumbering one
  without the other is an easy miss, always re-export the full flow after a renumber to catch it.

## 2026-07-12 — [area:design] Penpot prototype restructured into workflow-grouped flows with prototyping interactions

- **What:** the connected Penpot file's "Prototype — Parcours consolidé" page went from 22 screen
  boards scattered as flat siblings (same y, x decreasing ~460px each, no layout system) to 7 named
  `Flow N · <Title>` parent boards, each with a column flex layout (title label + a row-flex "Écrans"
  child holding the screens in numeric order): `Flow 1 · Onboarding` (1–5), `Flow 2 · Carte des
  relations` (6–7), `Flow 3 · Sous-groupes` (8–9), `Flow 4 · Envie & Match` (10–12), `Flow 5 ·
  Événements` (13–20), `Flow 6 · Notifications` (21), `Flow 7 · Paramètres` (22). The 7 flow boards
  are stacked in a single column on the page with 1300px y-gaps (each flow board ≈1042px tall, so
  ≈258px of clear breathing room between clusters) — no 7-group misfit found, all 22 screens mapped
  cleanly. Flow boards use the `nuit` colour as background so each cluster reads as a distinct card;
  titles use the library's `Title` typography (Space Grotesk 20/500) already used for screen titles.
- **Interactions:** 32 `click` → `NavigateTo` interactions wired directly on the actual tappable
  element (button, list row, tile, or feed item — not just "whole board"), reconstructed by reading
  each screen's `content` tree for a matching label: in-flow sequences (e.g. Bienvenue → Onboarding
  clés → … → terminé) plus cross-flow entry points found via real nav elements — Onboarding·terminé
  → Carte des relations, Carte's 4 dashboard tiles → Envie/Sous-groupes/Événements/Paramètres, Carte's
  2 feed items → Coïncidence/Événement·répondre, Sous-groupe·détail → Envie·émission, Fiche contact →
  Envie·émission, Événements' 3 list rows → Déclarer/répondre/Attention reçue, and the "Retour à la
  carte" buttons on 4 different event screens back to Carte des relations. Deliberately **not** wired
  (logged, not guessed): "Contact suivant" (loops in place, not a screen change), "Proposer" on
  Coïncidence (no dedicated outcome screen exists), "Ne rien faire" on Événement·répondre (calm-by-design
  — refusal must stay invisible, wiring it would contradict product law 5), the two RSVP buttons on
  Attention reçue and "Envoyer le message" on Événement·message (no dedicated confirmation screen
  exists for either — ambiguous target), and Paramètres has no back-to-Carte affordance in the
  prototype at all (flagged as a UX gap, not fabricated).
- **Consistency fixes:** segmented-control cells (`segb`, used on Intimité/Présence/Paramètres
  toggles, 17 instances across 3 screens) had a hardcoded `border-radius: 8`, which isn't in
  `docs/design-system.md`'s radii scale (10/12/14/999/50%/57/64) — relinked to the `radius.input`
  token (resolves to 10) via `shape.applyToken()`. The library's `Button`/`Tag` main components
  already had fully correct values (radius 12/999, colour `#e4be6a`/`#202949` exactly matching
  `etoile`/`voile`) but weren't linked to the token/colour assets by reference — attempted
  `applyToken()` on the main-instance shapes but it did not persist across plugin calls (values are
  already correct, so no visible defect; logging as an incomplete polish, not claiming it's done).
- **Flagged, not fixed:** 39 recurring micro-spacing values (rowGap 1/6, columnGap 10, padding 13,
  chip padding 10) inside `paycard`/`tile`/`tilerow`/`fitem`/`rowi`/`chip` — found identically across
  every instance of these compound components on every sampled screen, which reads as intentional
  sub-scale spacing already baked into shipped components rather than drift. Mechanically forcing
  them onto `docs/design-system.md`'s coarser 4/8/12/14/16/20/24 scale would visibly change dozens of
  already-shipped card/tile proportions — out of this task's "consistency enforcement, not creative
  redesign" scope. Needs verification against the consolidated HTML prototype and either an extension
  of the documented spacing scale or a deliberate normalization pass, tracked as a follow-up.
- **Verification:** every flow board checked for zero pairwise overlap and zero containment
  violations (`penpotUtils.isContainedIn` on every screen against its flow board); screen order
  confirmed identical to source (22/22 accounted for, none dropped/duplicated); visually verified via
  `export_shape` on Flow 1 (5 screens), Flow 5 (8 screens, widest), Flow 6 (1 screen), and the fixed
  `segb` radius on Flow 1. `export_shape` hit transient 30s timeouts several times during the session
  (plugin/render-queue load, not a disconnect — `execute_code` stayed responsive throughout); retries
  succeeded every time.
- **No blueprint changes:** screen content, copy, and flow order are unchanged — only the Penpot
  canvas organization and prototyping interactions were touched, so `blueprints/**` and
  `docs/design/swab-prototype-consolidated.html` stay in sync (no divergence to flag).
- **Gotcha for next agent:** `board.addFlexLayout()` on a *new empty* board is safe to call directly
  (only pre-existing children need `penpotUtils.addFlexLayout()` to preserve order); `applyToken()` on
  a component's *main instance* (as opposed to a regular shape/instance copy) silently failed to
  persist across `execute_code` calls in this session despite returning success both times — worth a
  focused repro before relying on it for main-component token linking again.

## 2026-07-12 — [ONB-01, ONB-02, IDT-01, IDT-02, IDT-03] New phone+OTP auth flow (sign-up/sign-in), design-only

- **Why:** the connected Penpot prototype jumped straight from "Bienvenue" to local key generation —
  no phone-number entry, no OTP verification, no "sign in" concept anywhere — even though phone+OTP
  auth is fully built server-side (`apps/api/src/routes/auth.ts`). `POST /auth/otp/verify` treats
  sign-up and sign-in identically (branches only at the very end, on whether `displayName` is
  supplied), so the design mirrors that: one shared phone+OTP entry, diverging only after
  verification. No "New here?/Returning?" choice screen — matches product law 5 (calm by design, no
  upfront self-classification).
- **What (design chain, in propagation order):** added the new screens' content to
  `docs/design/swab-prototype-consolidated.html` and mirrored verbatim into
  `blueprints/swab-app-prototype.html` (both stayed byte-identical, as before); added the **Text
  field** and **OTP code input** components to `docs/design-system.md` §4's component grammar table;
  built the Penpot side (new `Flow 0 · Authentification` board, before `Flow 1 · Onboarding`):
  - `1 · Bienvenue` — reparented from Flow 1 (not recreated); its CTA interaction retargeted from the
    old "Onboarding · clés" to the new phone screen.
  - `2 · Numéro de téléphone` (new) — indicatif + national-number Text field pair, the existing
    (screen-convention) privacy-note text style, CTA "Recevoir le code". Privacy copy sources FS-01's
    literal quote "Tout reste chiffré sur ton téléphone" (ONB-02); the rest is proposed copy.
  - `3 · Code de vérification` (new) — 6-box OTP input (auto-advance-styled), "Renvoyer le code" reusing
    the existing text-button style (cloned from "Terminer la calibration", not a new component), error
    state in `corail` ("Code incorrect, réessayez.").
  - `4 · Votre nom` (new, new-account branch) — display-name Text field + "Continuer", wired
    (`NavigateTo`) from screen 3 as the primary/novel path.
  - `5 · Bon retour` (new, returning-account branch) — reuses the existing `donehead` (ring + title +
    subtitle) pattern, not a new component.
  - Wiring: `1→2→3→4→(Flow 1's now-renumbered first screen)`; `5→Flow 2 · Carte des relations`'s first
    screen. Screen 3's conceptual branch to screen 5 (existing accounts) is **documented, not wired** —
    both the HTML prototype and Penpot's `NavigateTo` can only express one destination per trigger, so
    only the more novel new-account path is interactive; this mirrors the real branch point in
    `apps/api/src/routes/auth.ts`.
  - `Flow 1 · Onboarding` locally renumbered 1→4 (`Onboarding · clés/contacts/calibration/terminé`) now
    that `Bienvenue` moved out — including the previously-out-of-sync topbar title text on each
    renumbered screen (`characters` didn't auto-follow the board rename). Global leftover screen IDs on
    Flows 2–7 (from the prior restructuring task) were **not** touched, as out of scope.
  - Verified: zero pairwise overlap / zero containment violations on Flow 0 and the now-4-screen
    Flow 1 (`penpotUtils.isContainedIn`); every new screen and both new components spot-checked with
    `export_shape`.
- **Incomplete, flagged honestly:** the two new components (Text field, OTP code input; empty/focus/
  error states) are built and `export_shape`-verified as swatches inside the `Flow 0` board, and fully
  documented in `docs/design-system.md`, but **not yet placed into the "Swab — Design System" page's
  `§ Composants` section** — Penpot only allows writes to the page open in the connected browser tab,
  which stayed on "Prototype — Parcours consolidé" for this entire session (`appendChild` on a
  Design-System-page shape throws `Cannot modify a page that is not currently active`). Needs a
  follow-up pass with that page active. New-device sign-in (lost local vault key) is explicitly **not**
  designed — it needs the not-yet-designed recovery-phrase flow, open question OQ-IDT-2 in
  `docs/specs/FS-07-identity-vault.md` (VLT-05) — flagged on the "Bon retour" screen, not improvised.
- **Not touched (explicitly out of scope):** all app code (`apps/ios`, `apps/android`, `apps/api`,
  `apps/mobile`) — the real apps already have working phone+OTP auth; wiring the design to app code is
  a separate future `area:ios`/`area:android`/`area:web` task. `blueprints/swab - Onboarding
  (standalone) (1).html` — unchanged, it only covers post-auth calibration steps.

## 2026-07-12 — Wave 4: mobile E2E testing made a hard Definition-of-Done gate

- **What:** every functional requirement of the implemented specs (FS-01/02/03/07, ~40 requirement
  IDs) now has a scenario in new `docs/qa/e2e-scenarios.md` and a machine-readable verification-class
  entry in new `docs/qa/e2e-coverage.json` (`automated` / `unit-covered` / `api-integration` /
  `manual` / `not-e2e-verifiable` — honest classification, nothing silently dropped). New
  `scripts/e2e-report.mjs` (zero new dependencies — regex JUnit-XML parsing + `xcrun xcresulttool`
  shellout) joins on-device test results against that manifest and emits `test-results/e2e/e2e-report.{md,json}`,
  with a **drift guard**: the run fails if any requirement marked `automated` has no matching
  executed test, not just if a test fails. New wrapper entry points `scripts/e2e-android.sh` /
  `scripts/e2e-ios.sh` are the one-command gate (preflight API health + device check → full suite →
  report). `test-results/` and `*.xcresult` added to `.gitignore` — generated per run, never
  committed.
- **Why:** Waves 1–3 shipped strong unit coverage but the functional test doc (`docs/manual_tests/`)
  was a wave behind and mapped only to feature level, not requirement IDs; there was no automated
  on-device suite, no generated report, and nothing in the agents' Definition of Done required E2E
  before calling a task done.
- **Agent workflow guardrail:** `agents/_global-directives.md` (G2), `agents/ios-specialist.md`, and
  `agents/android-specialist.md` now require the platform's full E2E suite green via the wrapper
  scripts (report PASS, zero drift) before Done, with the report summary pasted into the PR; new/
  changed user-facing requirements update the scenario doc + manifest in the same PR.
  `docs/agent-playbook.md` §3/§5 updated to match. Rendered copies (`.github/`, `.claude/agents/`)
  regenerated via `node scripts/render-agents.mjs` — `--check` passes.
- **Platform suites landed and independently re-verified from clean by the lead** (not just agent
  self-report): Android 16/16 (`./gradlew :app:clean :app:connectedDebugAndroidTest`), iOS 13/13
  (`xcodebuild test`). Full detail in `apps/android/CHANGELOG.md` / `apps/ios/CHANGELOG.md` and
  `docs/migration/rn-audit-map.md`'s new Wave 4 section. Notably, the iOS suite exposed a real bug —
  `project.pbxproj` had code signing fully disabled since the Wave-1 app-shell scaffold (fine for
  bare `xcrun swift test`, but an unsigned app process has no Keychain entitlements once actually
  run via XCUITest); fixed with ad hoc signing (`CODE_SIGN_IDENTITY = "-"`, Simulator-only).
- **Doc truth-up:** FS-01/02/07 `Status:` headers flipped `Approved` → `Implemented` (they'd landed
  in Wave 1 but G5's header-flip step was missed at the time); FS-03's header corrected (said
  "Android parity pending" — Android landed in Wave 3). `docs/manual_tests/README.md` now points at
  the new suite as the binding gate, keeping itself as a manual/exploratory smoke-test doc.
- **Deferred (follow-up, not built this wave):** wiring the E2E gate into GitHub Actions CI (needs a
  macOS runner for XCUITest and a Linux/KVM emulator runner for `connectedAndroidTest` — cost/setup
  tradeoff, scoped to `area:sre`/devops-specialist, `.github/workflows` only). The gate today is
  local and agent-enforced, not yet machine-enforced on every PR.
- **Gotchas:** the iOS/Android Simulator/emulator can silently shut down between sessions —
  `xcrun simctl list devices booted` / `adb devices` should be checked before assuming either wrapper
  script will find a target. Docker Desktop does not auto-start the daemon on `docker compose up` if
  it isn't already running (`open -a Docker` first, then poll `docker info`).

## 2026-07-09 — Native migration Phase 1: iOS + Android specialists replace the Mobile (Expo RN) specialist

- **Decision:** Swab's mobile client moves from cross-platform Expo/React Native to fully native `apps/ios` (Swift/SwiftUI, MVVM) and `apps/android` (Kotlin/Jetpack Compose, MVVM). `apps/mobile` stays in the repo as the **frozen reference implementation** (read-only except critical fixes) until each module reaches native parity; it will be removed in a later PR. First migration target: FS-07 Identity & Vault + FS-01 Onboarding.
- **Knowledge inheritance before decommission:** the Mobile Engineering Specialist's complete context — feature inventory, binary contracts (AES-256-GCM vault wire format `base64(IV‖TAG‖CT)`, phone-hash `sha256("SALT:E164")`, API shapes, sync semantics), business rules, product ethos, known divergences, and RN-only gotchas — is captured in `docs/migration/rn-native-handoff.md`. Both new agent files import it as binding.
- New `docs/migration/vault-test-vectors.json` — crypto vectors generated from the RN reference implementation (node:crypto, API-identical to react-native-quick-crypto). Both native crypto cores must reproduce every vector exactly before building on top; this file is the objective "knowledge transfer verified" gate.
- Added `agents/ios-specialist.md` (area:ios, scope `apps/ios/**`) and `agents/android-specialist.md` (area:android, scope `apps/android/**`); registered in `scripts/render-agents.mjs` → `.github/instructions/{ios,android}.instructions.md` + `.claude/agents/{ios,android}-specialist.md`.
- Decommissioned the Mobile Engineering Specialist: removed from the `AGENTS` registry, deleted `agents/mobile-specialist.md` and its rendered copies (`.claude/agents/mobile-specialist.md`, `.github/instructions/mobile.instructions.md` — the render script never cleans up orphans, so this is manual by design).
- Docs updated to stay truthful: `agents/_global-directives.md` project description + G5 changelog locations, `CLAUDE.md`, `docs/STATUS.md`, `apps/mobile/CHANGELOG.md` freeze banner. `.specify/memory/constitution.md` still mirrors the pre-migration directives — **follow-up: re-run `/speckit-constitution` to resync** (global directives win on conflict, per governance).
- **Gotchas:** new Claude Code subagents are only picked up after a session restart. `apps/ios`/`apps/android` and their changelogs do not exist yet — they land with the Phase 2 scaffold PR, deliberately kept out of the turbo/pnpm pipeline (CI wiring is an `area:sre` follow-up).

## 2026-07-09 — New agent: Spec ↔ Notion Liaison Specialist (area:notion-liaison) + French spec mirror

- Added `agents/notion-liaison-specialist.md` — seventh specialist, the only bridge between `docs/specs/FS-*.md` (English, code-canonical) and a French mirror in Notion for the non-dev co-founder to read, comment on, and edit directly. Registered in `scripts/render-agents.mjs`; renders to `.github/instructions/notion-liaison.instructions.md` and `.claude/agents/notion-liaison-specialist.md`.
- Created the Notion structure: parent page "Swab — Spécifications (FS-*)" with one French subpage per FS-01…07, each carrying a "source canonique" note pointing back to its code file. Requirement IDs (ONB-01, MAP-03, …) preserved verbatim as translation anchors.
- New `docs/specs/.notion-sync.json` — sync-state file the agent owns. Stores full content snapshots (English + French, not hashes) per spec so the agent can diff by direct comparison. **Mandatory behavior:** every invocation re-fetches the live Notion page and comments before doing anything else — never assumes the last-synced snapshot is still current.
- **Design decision:** the co-founder can freely edit French text or comment (not comment-only) — free edit was chosen over the safer comment-only default. To offset that risk: code remains canonical (per CLAUDE.md), and if both the code and the Notion page changed since the last sync, the agent stops and reports the conflict instead of picking a side (G4 ambiguity rule extended to two-way doc sync).
- **Gotcha:** the Notion workspace connected this session is Hamza's own account — pages were created privately; sharing the parent page with the actual co-founder is a manual step (Notion's own share UI), not something the agent does autonomously.

## 2026-07-09 — First spec-kit pipeline test: specs/001-envie-match

- Ran `/speckit-specify` against the already-approved `docs/specs/FS-05-envie-match.md` as a pipeline test: does converting a mature FS-* spec into spec-kit's format lose precision? Result: `specs/001-envie-match/spec.md`, all requirement-quality checklist items pass, all 16 ENV-* requirement IDs traced through as FR-001…FR-016.
- FS-05 remains the authoritative source (stated explicitly in the new spec's header); this is a mirror for `/speckit-plan` and `/speckit-tasks` to consume, not a replacement. No other FS-* specs migrated yet — this was a one-feature trial.
- **Gotcha:** spec-kit's "technology-agnostic success criteria" guideline doesn't fully fit privacy/concurrency correctness properties (e.g. "non-match unobservable via API response") — documented as a deliberate, noted exception in the checklist rather than a failure.
- Next: `/speckit-plan` → `/speckit-tasks` on this same feature to judge whether the full pipeline is worth adopting repo-wide before migrating the remaining 6 specs.

## 2026-07-09 — New agent: Design & Blueprint Specialist (area:design)

- Added `agents/design-specialist.md` — sixth specialist, owner of the front of the blueprint → spec → code pipeline: HTML blueprints (`blueprints/`), the Penpot design system/prototype (via the Penpot MCP plugin), and the graphic charter « Nuit » (palette, typography, Button/Tag components, iPhone 17 template — values documented as normative in the agent file).
- Registered in `scripts/render-agents.mjs`; renders to `.github/instructions/design.instructions.md` and `.claude/agents/design-specialist.md`. Scope: `blueprints/**`, `docs/design/**`, Penpot; proposes (never edits) design tokens for `packages/ui`.
- Includes field-tested Penpot MCP gotchas from the 2026-07-09 prototype build (writes target the browser-active page; async layout sizing; white default fills; hex-only fill colors; spurious `:error` responses — verify before retrying).
- **Gotcha:** new Claude Code subagents are only picked up after a session restart.

## 2026-07-09 — GitHub spec-kit adopted for spec-driven development

- Installed [github/spec-kit](https://github.com/github/spec-kit) via `uvx --from git+https://github.com/github/spec-kit.git specify init --here --integration claude`. New tooling: `.specify/` (templates, scripts, workflow config) and `.claude/skills/speckit-*` (8 slash-command skills: constitution, specify, plan, tasks, implement, clarify, analyze, checklist).
- Ratified `.specify/memory/constitution.md` v1.0.0 by mirroring — not duplicating — the existing `agents/_global-directives.md` (G1–G5). Governance section states explicitly: if the two ever diverge, `agents/_global-directives.md` wins; amendments happen there first, then this constitution is re-synced via `/speckit-constitution`.
- Requires `uv` (Astral) locally — installed via `brew install uv`. Not yet wired into CI.
- **Gotcha:** `RATIFICATION_DATE` in the constitution is a `TODO` — the original adoption date of `agents/_global-directives.md` isn't recorded in repo history. Fill in if it's ever recovered.
- `CLAUDE.md` gained a "Spec-driven development (spec-kit)" section documenting the `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` flow and the constitution's mirror-not-replace relationship to `agents/_global-directives.md`. Existing `docs/specs/FS-*.md` specs are not being migrated into spec-kit's format — spec-kit is for new feature scaffolding going forward.
- Follow-up: this is the foundation for the intended blueprint → spec → code workflow (design system blueprints feeding `/speckit-specify`); no blueprint tooling exists yet.

## 2026-07-07 — Nuit design system: consolidated prototype, token contract, design agent merged into the design specialist

- **New design system « Nuit »** derived from the consolidated app prototype (Hamza's `swabappprototype`). Saved the prototype into the repo at `docs/design/swab-prototype-consolidated.html` as the normative reference (gabarit iPhone 17, 402 × 874 pt @3x).
- `docs/design-system.md`: the token contract — colour tokens (deep-blue `nuit #0F1426` base, `étoile #E4BE6A` accent, `sauge`/`ciel`/`corail` semantic status hues, ivoire/brume/ombre text ramp), Space Grotesk + Inter type scale, spacing/radii, and the component grammar (buttons, tags, segmented controls, tiles, rows, switch, journal, done-header, privacy note…). This supersedes the earlier earthy `#16120D` blueprint palette.
- **Merged into the existing `area:design` agent** (`agents/design-specialist.md`, previously "Design & Blueprint Specialist") rather than adding a second design agent: scope widened to `docs/design-system.md` and `packages/ui/**` foundations alongside `blueprints/**`/`docs/design/**`; registry `applyTo` in `scripts/render-agents.mjs` updated to match; rendered Copilot (`.github/instructions/design.instructions.md`) and Claude Code (`.claude/agents/design-specialist.md`) copies regenerated.
- Updated the web-frontend agent's stale palette note (`#16120D` → Nuit `#0F1426`) and re-rendered.
- **Penpot:** the design library (colour styles, typographies, components, tokens) is built from `docs/design-system.md` via the Penpot MCP plugin — see `docs/STATUS.md` for library state. Requires the plugin to be connected to the project.

## 2026-07-06 — Repo-wide ESLint (flat config): `lint` is now a real gate

- Root `eslint.config.mjs`: typescript-eslint `recommendedTypeChecked` (type-aware via `projectService`, off each package's own tsconfig) + `eslint-config-prettier` last (Prettier stays the formatter). Bug-catching extras: `eqeqeq`, `no-console` (G3: pino only), `switch-exhaustiveness-check`. Test files relax `require-await`, `no-require-imports` (jest fresh-module pattern) and the `no-unsafe-*` family (jest mocks are any-typed).
- `apps/mobile/eslint.config.mjs` composes `eslint-config-expo/flat` (React/RN/react-hooks rules) with the root base. ESLint 9 resolves configs from each package's cwd upward, so api/db use the root file directly.
- All three packages now run `eslint .` as their `lint` script — the mobile stub (`exit 0`) is gone. `turbo.json` gained `globalDependencies: ["eslint.config.mjs"]` so config edits invalidate lint caches.
- New root devDependencies (justification: repo-wide lint tooling): `eslint@^9`, `@eslint/js@^9`, `typescript-eslint@^8`, `eslint-config-prettier`; `apps/mobile` adds `eslint@^9` + `eslint-config-expo@^57`.
- **Gotcha (pnpm):** mobile MUST declare `eslint` itself — without it, pnpm's auto-install-peers satisfied `eslint-config-expo`'s peer with eslint@10, producing a second `@typescript-eslint/eslint-plugin` instance and a "Cannot redefine plugin" ConfigError. Keep the eslint majors aligned across root and mobile.

## 2026-07-06 — Agent prompts consolidated to one source + render script

- `agents/*.md` is now the ONLY editable location for agent behavior. `scripts/render-agents.mjs` generates all tool copies: `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md` (verbatim renders for Copilot) and `.claude/agents/*.md` (thin wrappers whose `@` imports resolve back to `agents/` at runtime for Claude Code).
- Removed the `agents/claude-code/` staging directory and the manual `cp` install step; `.claude/agents/` is now generated and tracked in git (works right after clone).
- `node scripts/render-agents.mjs --check` exits non-zero if renders are stale — wire it into CI as a required check (`area:sre` follow-up).

## 2026-07-06 — Maintainability pass: status doc, per-area changelogs, agent upgrades

- Added `docs/STATUS.md` — the single summary of what is implemented, per spec module and per infrastructure item.
- Added per-area `CHANGELOG.md` files (mobile, api, db, root) seeded from git history; new directive **G4.7** makes updating them part of every agent's Definition of Done.
- Upgraded agent prompts (`agents/*.md`) with changelog/status duties and field-tested gotchas (pnpm strict layout, Expo autolinking, dev-client rebuilds); re-rendered Copilot + Claude Code copies.
- `.gitignore` hardened: native `android/`/`ios/` dirs (Expo CNG — regenerated by `expo run`), build info, IDE noise, `.claude/agents/` (rendered copies).
- README setup/run sections corrected (Docker-first local dev; Neon/Vercel only for cloud), Android SDK PATH instructions added.

## 2026-07-05 — Local dev stack + Android tooling

- `docker-compose.yml`: Postgres 17 (:5432, named volume), API (:3001, schema push on boot), Adminer (:8080). `.dockerignore`, `apps/api/Dockerfile`.
- `scripts/`: `setup-android-emulator.sh` (SDK env + AVD management), `run-android.sh`, `run-ios.sh` quick-starts; `ANDROID_SETUP.md`, `DEVELOPMENT.md` guides.
- Android SDK PATH added to shell config; two AVDs (Pixel 6 Pro / Pixel 8 Pro) provisioned.

## 2026-07-04 — Project foundation (commits 02a3739, 456bf42, 66e2f03)

- Monorepo init: Turborepo + pnpm workspace, strict TS base config, blueprints, `docs/` (product overview, agent playbook, FS-01..07 specs with stable requirement IDs), domain spec, AIDD blueprint.
- Agents v1: `agents/_global-directives.md` (single source of truth) + five specialists, rendered to `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, and `agents/claude-code/`.
- CI skeleton (`.github/workflows/ci.yml`).
