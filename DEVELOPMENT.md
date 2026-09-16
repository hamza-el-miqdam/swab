# Local Development & Testing Guide

How to run Swab locally: the API (two routes), the native iOS and Android apps, and the on-device E2E gates.

## Prerequisites

**Everyone**

- [ ] Node.js 22 (`.nvmrc` pins `22.23.2`) and pnpm `10.12.1` (pinned in `package.json` → `packageManager`)
- [ ] `pnpm install` at the repository root

**Android**

- [ ] Android SDK (platform-tools + emulator), with `ANDROID_HOME` exported
- [ ] JDK 17 or newer (the app compiles to Java 17; CI uses Temurin 17)
- [ ] An AVD on an **API 34** system image (see [E2E gates](#e2e-gates))

**iOS (macOS only)**

- [ ] Xcode and an iPhone Simulator (deployment target iOS 17.0)

**Only for the real-Postgres route**

- [ ] Docker with Compose

Neon CLI and Vercel CLI are not needed for local development.

## Quick Start

Run everything from the repository root unless a step says otherwise.

### 1. Start the local API

Two routes, both serving port 3001 — run one at a time.

**Route A — no database** (enough for both E2E gates)

```bash
pnpm --filter @repo/api dev:local
```

Runs the real API routes on an in-memory repository (`apps/api/tests/dev-local-server.ts`): OTP dev codes enabled, relaxed OTP rate limit, `/ready` answers ready with no database to check, and all data is lost when the process exits. `PORT` overrides the port. It exercises neither Prisma nor database constraints — use route B when that matters.

**Route B — real Postgres**

```bash
docker compose up --build       # add -d for the background
```

Starts Postgres 17 on `127.0.0.1:5432`, the API on port 3001 (it runs `prisma migrate deploy` first) and Adminer on `127.0.0.1:8080` — log in with System `PostgreSQL`, Server `db`, Username `swab`, Password `swab_local_dev`, Database `swab`. `docker compose watch` syncs `apps/api/src` into the running container; `docker compose down` stops the stack.

Check either route:

```bash
curl http://localhost:3001/health   # {"status":"ok"}
curl http://localhost:3001/ready    # {"status":"ready",...} — 503 under compose while the database is unreachable
```

### 2. Run an app

Both apps talk to the same API on port 3001, so an emulator and a Simulator can run side by side against one backend.

#### Android emulator

```bash
emulator -list-avds
emulator -avd <name> -no-snapshot-load &
cd apps/android && ./gradlew installDebug
```

Debug builds reach the API at `http://10.0.2.2:3001`: `10.0.2.2` is the emulator's alias for the host machine's loopback, since inside the emulator `localhost` is the emulator itself. The value is `BuildConfig.API_BASE_URL`, set in `apps/android/app/build.gradle.kts` (release builds use `https://api.swab.app`) — there is no `.env` file for the Android app. Because that address is emulator-only, a physical device cannot reach the local API with the debug build as-is.

Unit tests: `cd apps/android && ./gradlew test` — the same command CI runs.

#### iOS Simulator (macOS)

Open `apps/ios/SwabApp.xcodeproj` in Xcode and run the `SwabApp` scheme on an iPhone Simulator. The API URL comes from the `SWAB_API_BASE_URL` build setting (`http://127.0.0.1:3001`), handed to the app through the `SwabApiBaseURL` key in `Info.plist`; the Simulator shares the Mac's loopback, so no alias is needed. The app stops at launch if that value is missing, and any non-loopback URL must be HTTPS.

Unit tests: `cd apps/ios && xcrun swift test` — the same command CI runs.

## What to test

Flows are specified, not improvised: every functional requirement's scenario lives in `docs/qa/e2e-scenarios.md`, joined to the automated suites through `docs/qa/e2e-coverage.json`, with the requirements themselves in `docs/specs/FS-*.md`. Signing up locally needs no SMS provider — both API routes run with `OTP_DEV_CODE=enabled`, which returns the code in the API response for the app to display.

## E2E gates

The on-device suites are the G2 Definition of Done for every `area:ios` / `area:android` task. Both need a local API on port 3001 (either route) and a booted emulator/simulator.

**Android** — use an **API 34** emulator image. On API 35+ the pinned Espresso dies inside `Espresso.onIdle` with a `NoSuchMethodException` for `InputManager.getInstance`, so every Compose UI test fails for reasons unrelated to the app and the script refuses to run there (issue #56).

```bash
scripts/e2e-android.sh                          # preflight, then ./gradlew :app:connectedDebugAndroidTest
CLEAN=1 scripts/e2e-android.sh                  # clean build first — use for wave sign-off
ALLOW_UNSUPPORTED_API=1 scripts/e2e-android.sh  # bypass the API-level guard
```

The script preflights `/health`, an `adb`-visible device and the emulator's API level. It finds `adb` through `ANDROID_HOME`, falling back to `$HOME/Library/Android/sdk` (the macOS default), so export `ANDROID_HOME` anywhere else.

**iOS**

```bash
scripts/e2e-ios.sh                        # uses the first booted simulator
SIMULATOR_UDID=<udid> scripts/e2e-ios.sh  # explicit target
```

It preflights `/ready` (route A satisfies that too, though the error message only mentions docker compose), runs the `SwabAppUITests` target through `xcodebuild` and writes `test-results/e2e/ios-e2e.xcresult`. `xcrun simctl list devices booted` lists booted simulators; `xcrun simctl boot <udid>` boots one.

Both scripts write `test-results/e2e/e2e-report.md` (plus `e2e-report.json`) and exit 0 only if every test passed and the coverage manifest shows no drift. A task is Done when that report is PASS with zero drift-guard failures — paste its summary into the PR.

## Troubleshooting

| Issue | Solution |
|---|---|
| "Port 3001 already in use" | Only one API route at a time: Ctrl+C for `dev:local`, `docker compose down` for compose. Last resort: `lsof -ti :3001 \| xargs kill -9` |
| Android app can't reach the API | Confirm `curl http://localhost:3001/health` works on the host; the debug build's `10.0.2.2` only resolves from an emulator |
| `scripts/e2e-android.sh` sees no device although the emulator is running | `ANDROID_HOME` is unset, so the script looked for `adb` in the macOS default SDK path |
| Android E2E fails wholesale with `NoSuchMethodException ... InputManager.getInstance` | The emulator is API 35+; use an API 34 image (issue #56) |
| Android emulator won't start | `emulator -avd <name> -no-snapshot-load -wipe-data` |
| iOS Simulator stuck | `xcrun simctl erase all` |
| `prisma migrate deploy` fails against an old local database | It was created with `prisma db push`; run `pnpm --filter @repo/db exec prisma migrate resolve --applied 20260719000000_init` once |

## Database reset (route B)

```bash
docker compose down -v      # deletes the db-data volume
docker compose up --build   # migrations re-applied to an empty database
```

## Configuration

| Setting | Where it is set | Local value | Purpose |
|---|---|---|---|
| `BuildConfig.API_BASE_URL` | `apps/android/app/build.gradle.kts` (debug) | `http://10.0.2.2:3001` | API URL for the Android app (release: `https://api.swab.app`) |
| `SWAB_API_BASE_URL` | `apps/ios/SwabApp.xcodeproj` build settings → `Info.plist` key `SwabApiBaseURL` | `http://127.0.0.1:3001` | API URL for the iOS app |
| `PORT` | API environment | `3001` | Port the API listens on |
| `DATABASE_URL` | `apps/api/.env.example`, `packages/db/.env.example`; the compose `api` service sets its own (host `db`) | `postgresql://swab:swab_local_dev@localhost:5432/swab` | Postgres connection — route A does not need it |
| `OTP_DEV_CODE` | API environment (set by compose and by `dev:local`) | `enabled` | Returns the OTP code in the API response; the API refuses to boot with it enabled when `NODE_ENV=production` |

## Further Reading

- [README.md](./README.md) — project overview and full setup
- [docs/product-overview.md](./docs/product-overview.md) — product vision
- [docs/agent-playbook.md](./docs/agent-playbook.md) — development workflow
- [docs/qa/e2e-scenarios.md](./docs/qa/e2e-scenarios.md) — E2E scenarios per requirement
