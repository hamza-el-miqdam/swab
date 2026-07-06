# Swab (صواب)

> **« صواب — jouer franc jeu. Dis ce dont tu as envie. À qui tu veux. Sans jamais avoir à demander. »**
> 
> "Say what you want, to whom you want, without ever having to ask."

Swab connects people with their friends and loved ones by removing the social cost of asking. Express a desire (*envie*), choose *who could receive it* — a scope, never a person — and the other side learns about it **only if the desire is mutual**. No rejection is ever visible; no silence is ever explained.

This project is developed using an **AI-Driven Development (AIDD)** methodology, where AI agents, guided by strict directives and architectural blueprints, perform a significant portion of the coding and maintenance tasks. All development follows documented specifications (`FS-*` requirements) with traceability enforced through tests, commits, and PRs.

## 🎯 The Five Product Laws

These principles are non-negotiable and enforced in code review:

1. **Mutual reveal only** — A desire is invisible to its recipients until reciprocated. A non-match leaves zero observable trace on either side.
2. **Nothing hidden silently** — Every filter applied at send time is shown to the sender and revocable in place.
3. **You declare, Swab never guesses** — Relationship classification is user-declared, asymmetric, and private. No inference, no suggestions.
4. **Privacy is structural, not a setting** — Classification data never leaves the device unencrypted; the server cannot read it.
5. **Calm by design** — No counters, badges, streaks, celebrations, urgency, or gamification. Soft language everywhere.

## ✨ Core Concepts

*   **Privacy First**: The user's relationship classification data (intimacy, roles, feelings, etc.) is encrypted and stored only on the user's device in a "vault." The server stores this vault as an opaque, unreadable blob. No one—not even Swab—can see how a user classifies their relationships.
*   **Transparent Matching**: When a user expresses a desire (*envie*), the scope of recipients is resolved on the client using local rules and filters. The server only sees the final list of recipient IDs, never the rules. A match is only revealed to both parties simultaneously when their desires are compatible.
*   **AI-Driven Workflow**: Development follows a stage-gated pipeline (`Spec` → `Schema` → `Implement` → `Verify` → `Deploy`) with strict requirement traceability. AI agents own specific scopes (e.g., `area:api`, `area:mobile`) and work in parallel with git as the event bus.

## 📋 MVP Scope & Glossary

**In:** phone-OTP signup, contact import + invite, relationship map with radial visualization, contact card with 4 axes (Intimité / Rôles·contexte / État / Ressenti), on-device FCA subgroups, 3-level filter rules, envie emission with transparent filtering, mutual matching, simultaneous notifications, place/time proposals, silent pass, encrypted vault sync.

**Out (POC):** group envies (>2-person), chat/messaging, semantic verb matching, media, web relationship map, social graph suggestions.

| Term (FR) | English | Meaning |
|---|---|---|
| **envie** | desire | A present-tense want, sent to a scope, matched mutually |
| **portée** | scope | A set of potential recipients — always a subgroup, never an individual |
| **carte des relations** | relationship map | Radial view: me at center, contacts on intimacy rings |
| **fiche contact** | contact card | Per-relation detail: 4 axes + history feed |
| **les quatre axes** | the four axes | Intimité / Rôles·contexte / État / Ressenti — declared, private, asymmetric |
| **sous-groupe** | subgroup | FCA-detected cluster usable as a scope; pin/rename/hide only |
| **filtrage** | filtering | Send-time exclusion by rules: absolute veto / excluded by default / low priority |
| **match** | match | Mutual envie compatibility; both sides notified simultaneously |
| **vault** | vault | On-device encrypted store of all classification data; server holds opaque blob |

## 🏗️ Architecture & Development Model

### Module Map (MVP)
```
FS-07 Identity & Vault  ──┐  (foundation: everything depends on it)
FS-01 Onboarding        ──┤
FS-02 Relationship Map  ──┼── FS-04 Subgroups (scopes) ──┐
FS-03 Contact Card      ──┘                              ├── FS-05 Envie & Match
                              FS-06 Filtering rules   ───┘
```

### Ownership & Roles

| Area | Responsibility |
|---|---|
| **Mobile** (FS-01, FS-02, FS-03, FS-04, FS-06) | Onboarding, relationship map, contact cards, subgroups, filtering (vault ops only) |
| **Backend** (FS-07, FS-05 matching) | Auth, vault storage, OTP, contact discovery, envie matching engine |
| **Data** | Schema ownership, migrations, constraints; proposals only from other areas |
| **Web** | Landing page, invite flow, account management |
| **DevOps** | CI/CD, database setup, scope guard, privacy audits |

### Working Principles

- **Requirement Traceability**: Every functional requirement has a stable ID (`FS-*`, `ONB-*`, `ENV-*`). Issues, branches, commits, and tests reference these IDs — the chain must be complete.
- **Specs are versioned**: Changing behavior means updating the spec in the same PR. Code and spec never disagree on `main`.
- **Privacy Audit**: Before external testing and after every schema/API change, the standing privacy audit runs: DB audit, wire audit (vault only), log audit (forbidden verbs/hashes), non-observability tests.

## 🚀 Getting Started

Follow these steps to set up your local development environment.

### Prerequisites

**Common (local development):**
*   Node.js (v20 or higher)
*   pnpm (v10.12.1 or higher) — `corepack enable`
*   Git
*   Docker Desktop (or any Docker Engine with Compose v2) — runs Postgres + API locally

**For iOS:**
*   macOS with Xcode installed (via App Store)
*   iOS Simulator (installed with Xcode)

**For Android:**
*   Android Studio (`brew install --cask android-studio`) — includes the SDK, emulator, and build tools
*   An Android Virtual Device (AVD) — see [ANDROID_SETUP.md](./ANDROID_SETUP.md) or run `./scripts/setup-android-emulator.sh`
*   Android tools on your PATH (add to `~/.zshrc`):
    ```bash
    export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
    export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
    ```

**Cloud only (not needed to run locally):**
*   Neon CLI (database branching) and Vercel CLI (environment variables) — used for preview/production deployments.

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Swab
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start the local backend

No cloud accounts needed — everything runs in Docker:

```bash
docker compose up --build
```

This starts Postgres (:5432), the API (:3001, schema pushed on boot), and Adminer (:8080). See [Run the app](#-run-the-app-ios--android-with-docker) below for the full flow.

> **Cloud setup (optional, deploys only):** `neonctl auth`, `vercel login`, `vercel link`, then `vercel env pull .env.local` to get a Neon `DATABASE_URL`, and `pnpm db:migrate` against your Neon dev branch. Not required for local development.

### 4. Set up iOS Simulator (macOS only)

Xcode comes with iOS Simulator built-in. Verify it's available:

```bash
xcrun simctl list devices available
```

To open the simulator directly:

```bash
open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app
```

### 5. Set up Android Emulator

The scripted path (checks your SDK, lists/creates AVDs, prints next steps):

```bash
./scripts/setup-android-emulator.sh            # status + instructions
./scripts/setup-android-emulator.sh --create   # create a new AVD
```

Or manually via Android Studio: **More Actions** → **Virtual Device Manager** → **Create Device** (Pixel 6 Pro or similar, Android 14+ image). Full walkthrough in [ANDROID_SETUP.md](./ANDROID_SETUP.md).

Verify and start (requires the PATH setup from Prerequisites):

```bash
emulator -list-avds
emulator -avd Pixel_8_Pro -no-snapshot-load &
```

> `zsh: command not found: emulator` → the Android SDK isn't on your PATH; add the export lines from Prerequisites to `~/.zshrc` and open a new terminal.

## 📱 Run the app (iOS / Android) with Docker

The fastest way to run Swab locally: Postgres and the API run in Docker; the mobile app runs on a simulator/emulator or a physical device.

### Prerequisites

*   Docker Desktop (or any Docker Engine with Compose v2)
*   Node.js ≥ 20 and pnpm (`corepack enable`)
*   **iOS**: macOS with Xcode + an iOS Simulator installed
*   **Android**: Android Studio with an AVD (emulator) created, or a device with USB debugging

### 1. Start the backend + database

From the repo root:

```bash
docker compose up --build
```

This starts `postgres:17` (port 5432, data persisted in a named volume) and the API on **http://localhost:3001**. On boot the API container pushes the Prisma schema into the database (`prisma db push` — the dev-loop equivalent until real migrations land) and starts in watch mode.

Check it's alive:

```bash
curl http://localhost:3001/health   # {"status":"ok"}
curl http://localhost:3001/ready    # {"status":"ready","db":{...}}
```

Reset the database completely with `docker compose down -v`.

**Database UI** — [Adminer](http://localhost:8080) starts with the stack (~20 MB image). Log in with: System `PostgreSQL`, Server `db` (pre-filled), Username `swab`, Password `swab_local_dev`, Database `swab`. You can browse and edit every table (`users`, `vaults`, `envies`, …) — and verify the privacy invariant yourself: `vaults.blob` is unreadable ciphertext even with full DB access.

> Prefer a terminal? `pnpm --filter @repo/db db:studio` runs Prisma Studio against the same `DATABASE_URL`.

### 2. Install workspace dependencies (for the mobile app)

```bash
pnpm install
```

### 3. Point the app at the API

The API URL differs per platform because emulators have their own network namespace:

| Target | `EXPO_PUBLIC_API_URL` |
|---|---|
| iOS Simulator | `http://localhost:3001` (default — nothing to do) |
| Android Emulator (AVD) | `http://10.0.2.2:3001` (AVD's alias for your host's localhost) |
| Physical device (same Wi-Fi) | `http://<your-machine-LAN-IP>:3001` |

For Android or a device, create `apps/mobile/.env`:

```bash
echo "EXPO_PUBLIC_API_URL=http://10.0.2.2:3001" > apps/mobile/.env
```

### 4. Build and run the app

⚠️ The vault encryption uses a native module (`react-native-quick-crypto`), so the app runs in an **Expo dev client, not Expo Go** — use `expo run`, which builds one automatically:

```bash
cd apps/mobile

# iOS (first build compiles the native project — takes a few minutes)
npx expo run:ios

# Android (emulator must be running, or a device plugged in)
npx expo run:android
```

Subsequent starts reuse the built dev client: `npx expo start --dev-client`.

### 5. Sign in (POC note)

There's no SMS provider wired yet: in non-production the API returns the OTP code in the response, and the OTP screen displays it as `Code (dev): 123456`. Type it to complete signup — the rest of the onboarding (contacts, radial calibration) is fully local and works even with the backend stopped.

**Troubleshooting**

*   `expo run:android` can't reach the API → confirm `apps/mobile/.env` has `10.0.2.2`, not `localhost`.
*   Android emulator won't start → check `emulator -avd <name> -no-snapshot-load` for errors; if permission denied, restart Android Studio.
*   iOS Simulator won't launch → try `xcrun simctl erase all` to reset all simulators, then `npm expo run:ios`.
*   `/ready` returns 503 → the DB container isn't healthy yet; `docker compose logs db`.
*   Changed the Prisma schema → restart the api service (`docker compose restart api`) to re-push it.
*   Vault encryption errors on Android → ensure you're using `expo run:android` (dev client), not Expo Go.
*   Simulator/emulator stuck → kill and restart: `pkill -9 Simulator` (iOS) or `pkill -9 qemu-system-arm64` (Android).

## 🤖 AI tooling integration

The agent rules in `/agents` are rendered for both assistants (source of truth stays in `/agents`):

*   **GitHub Copilot** (VS Code + coding agent): picked up automatically from `.github/copilot-instructions.md` (repo-wide) and `.github/instructions/*.instructions.md` (path-scoped — e.g. editing a file under `apps/mobile/` activates the mobile specialist rules).
*   **Claude Code** (VS Code extension + CLI): `CLAUDE.md` loads automatically. Install the five specialist subagents once per clone:
    ```bash
    mkdir -p .claude/agents && cp agents/claude-code/*.md .claude/agents/
    ```
    Then in Claude Code, `/agents` lists them; e.g. "use the data-steward to add an index" delegates with the right scope and rules.

## 🛠️ Development

Quick-start helpers in `scripts/` (see [scripts/README.md](./scripts/README.md)):

```bash
./scripts/run-ios.sh          # configure + instructions for iOS Simulator
./scripts/run-android.sh      # start emulator, configure API URL, instructions
```

Day-to-day guide: [DEVELOPMENT.md](./DEVELOPMENT.md). This is a Turborepo monorepo — run commands from the root:

```bash
pnpm turbo run lint typecheck test build   # full gate (CI parity)
pnpm --filter @repo/mobile test            # per-package
pnpm --filter @repo/api test
pnpm --filter @repo/db db:generate         # regenerate Prisma client
```

## 📚 Documentation

Comprehensive documentation is in the `./docs/` folder:

*   **[docs/STATUS.md](./docs/STATUS.md)** — **What is done** — implementation status per module and per infrastructure item (start here to see where the project stands)
*   **Changelogs** — per-area history: [mobile](./apps/mobile/CHANGELOG.md) · [api](./apps/api/CHANGELOG.md) · [db](./packages/db/CHANGELOG.md) · [root](./CHANGELOG.md) (devops/docs/tooling). Every change lands with an entry (rule G5).
*   **[docs/README.md](./docs/README.md)** — Doc index and MVP module map
*   **[docs/product-overview.md](./docs/product-overview.md)** — Vision, personas, glossary, MVP scope (start here for understanding the product)
*   **[docs/agent-playbook.md](./docs/agent-playbook.md)** — How specifications are turned into code, requirement traceability, Definition of Ready/Done
*   **[docs/specs/](./docs/specs/)** — Functional specifications (`FS-01` through `FS-07`), one per module
*   **[swab-domain-spec.md](./swab-domain-spec.md)** — Data model and Prisma schema
*   **[aidd-multi-agent-blueprint.md](./aidd-multi-agent-blueprint.md)** — AIDD architecture and pipeline

Key principle: every functional requirement has a stable ID (`FS-*`, `ONB-*`) and must be traceable through issues, PRs, and tests.

## 🔒 Privacy & Security

This project takes privacy as a core architectural commitment, not a feature. Before merging any changes:

1. **Schema changes** → must pass the privacy audit (DB doesn't leak rings/tags/rules)
2. **API changes** → wire audit (vault data is opaque in `POST /vault` only)
3. **Vault operations** → log audit (no forbidden verbs/hashes/tokens)
4. **Match flow** → non-observability tests (non-matches leave zero observable trace)

All merges block on a passing privacy audit.

## 🤝 Contributing

1. Reference the requirement ID in your branch, PR title, and commit messages
2. Write tests first (acceptance criteria become failing tests)
3. Aim for 80% coverage on changed packages
4. UI copy comes from specs/blueprints verbatim — never invent French copy
5. Reference the five product laws when in doubt

See [docs/agent-playbook.md](./docs/agent-playbook.md) for the complete working protocol.