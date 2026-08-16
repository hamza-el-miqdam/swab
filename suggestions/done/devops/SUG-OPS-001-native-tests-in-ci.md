# SUG-OPS-001 — Native iOS/Android unit tests are not run in CI at all

- **Area:** devops
- **Topic:** ci
- **Impact:** high
- **Effort:** M
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G2 — Test-Driven Development)

## Problem / Opportunity

`.github/workflows/ci.yml` has exactly one job on `ubuntu-latest` running only the JS pipeline (`ci.yml:16-28`: `pnpm turbo run lint typecheck test build`). The mobile clients — the bulk of the implemented product per `docs/STATUS.md` (FS-01/02/03/07 all "Mobile") — have zero CI coverage: neither `cd apps/android && ./gradlew test` nor `cd apps/ios && xcrun swift test` (both documented as the native gates in `CLAUDE.md` "Commands") run anywhere. `docs/STATUS.md:32` already flags "native E2E workflow (macOS + emulator runners — filed follow-up)" as missing, but even plain *unit* tests (no emulator/simulator needed) are absent. A PR that breaks `apps/android` or `apps/ios` unit tests merges green today.

Evidence:
- `.github/workflows/ci.yml:15-28` — only job, no gradle/xcode steps.
- `apps/android/gradlew` exists (wrapper committed); Kotlin 2.0.21 (`apps/android/build.gradle.kts:5`), compileSdk 35 (`apps/android/app/build.gradle.kts:15`) — JVM unit tests run fine on Linux.
- `apps/ios/Package.swift` exists — `swift test` runs the SPM test target on a macOS runner without a simulator.

## Implementation plan

1. Edit `.github/workflows/ci.yml`, add two jobs after the existing `ci` job (keep `permissions: contents: read` at workflow level):

   ```yaml
     android-unit:
       runs-on: ubuntu-latest
       timeout-minutes: 30
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-java@v4
           with:
             distribution: temurin
             java-version: 17
         - uses: gradle/actions/setup-gradle@v4   # provides Gradle build/config cache
         - name: Android unit tests
           run: ./gradlew test --stacktrace
           working-directory: apps/android

     ios-unit:
       runs-on: macos-15
       timeout-minutes: 30
       steps:
         - uses: actions/checkout@v4
         - name: iOS SwiftPM unit tests
           run: xcrun swift test
           working-directory: apps/ios
   ```
2. Add path filters so macOS minutes (10x billing multiplier on private repos) are only spent when needed: either `dorny/paths-filter` or a `paths:` trigger split. Simplest robust variant: compute changed paths in a first job with `git diff --name-only origin/main...` and gate `ios-unit`/`android-unit` with `if:` on outputs. If that is too much for one PR, land the jobs unconditionally first and optimize in a follow-up.
3. Do NOT add emulator/simulator E2E (`scripts/e2e-ios.sh` / `scripts/e2e-android.sh`) in this PR — that is the separate follow-up already tracked in `docs/STATUS.md:32`; these scripts also require the live docker-compose API (`scripts/e2e-ios.sh:10-11`).
4. Update `docs/STATUS.md:32` CI row note (native unit tests now covered; E2E still pending) and add a root `CHANGELOG.md` entry (G5) — devops agent does this when implementing, per its DoD.

## Tests & acceptance criteria

- Open a PR with the workflow change; all three jobs green.
- Sanity check: intentionally break one Android unit test on the branch, confirm `android-unit` fails, revert.
- `actionlint .github/workflows/ci.yml` clean.

## Risks & gotchas

- macOS runners: verify the repo's plan has macOS minutes; if the free-tier budget (devops rule "Free-tier budget is an SLO") is a concern, run `ios-unit` only on PRs touching `apps/ios/**`.
- `xcrun swift test` needs an Xcode version supporting the Swift tools version in `apps/ios/Package.swift` — pin with `maxim-lobanov/setup-xcode` or `sudo xcode-select` if the default macos-15 image mismatches.
- `./gradlew test` first run downloads the Android SDK components; `gradle/actions/setup-gradle` caches distributions but the SDK comes from the preinstalled `ANDROID_HOME` on ubuntu runners — compileSdk 35 is preinstalled on current images; if not, add `android-actions/setup-android`.
