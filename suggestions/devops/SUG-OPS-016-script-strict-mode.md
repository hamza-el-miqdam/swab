# SUG-OPS-016 — Helper scripts use `set -e` only: no `-u`/`pipefail`, unlike the E2E gates

- **Area:** devops
- **Topic:** scripts
- **Impact:** low
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a

## Problem / Opportunity

The two Definition-of-Done gates are done right — `scripts/e2e-ios.sh:6` and `scripts/e2e-android.sh:6` both use `#!/usr/bin/env bash` + `set -euo pipefail`. The remaining helper scripts are weaker:

- `scripts/run-ios.sh:1,5` — `#!/bin/bash`, `set -e` only
- `scripts/run-android.sh:1,6` — `#!/bin/bash`, `set -e` only
- `scripts/setup-android-emulator.sh:1,7` — `#!/bin/bash`, `set -e` only
- `scripts/test-ios-functional.sh:1-2` — `#!/bin/bash`, `set -e` only
- `scripts/test-android-functional.sh:1-2` — `#!/bin/bash`, `set -e` only

Without `-u`, a typo'd or unset variable (e.g. an unset `$ANDROID_HOME`-derived path) silently expands to empty — `rm -rf "$SOME_DIR/"` classes of bugs. Without `pipefail`, failures upstream of a pipe (`xcrun ... | grep ...`) are swallowed and the script continues on garbage. `#!/bin/bash` also bypasses a Homebrew bash on macOS in favor of the ancient system 3.2 (the `env bash` shebang in the e2e scripts picks up PATH's bash). These are exactly the flaky-prone patterns that cost debugging hours on "worked yesterday" local tooling.

## Implementation plan

1. In each of the five scripts listed above, change the first lines to:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   ```
   (Replace the existing `#!/bin/bash` and `set -e` lines; keep everything else.)
2. Then fix what `-u` flushes out: run each script once; any legitimately-optional variable gets an explicit default (`"${AVD_NAME:-}"`, `"${ANDROID_HOME:-$HOME/Library/Android/sdk}"` — the pattern already used at `scripts/e2e-android.sh:9`). Expect a handful of parameter-expansion touch-ups in `run-android.sh`/`setup-android-emulator.sh` (they take optional positional args per their usage comments, so `$1` references need `${1:-}`).
3. Add `shellcheck` as the verification tool (do not add a CI job in this PR — these are local dev scripts; a `shellcheck scripts/*.sh` CI step can ride along with SUG-OPS-012 if wanted): fix or explicitly `# shellcheck disable=SCxxxx`-annotate remaining warnings.
4. Root `CHANGELOG.md` entry (one line).

## Tests & acceptance criteria

- `shellcheck scripts/*.sh` → no errors (warnings triaged).
- `bash -n scripts/*.sh` parses clean.
- Functional smoke: `scripts/setup-android-emulator.sh` (list mode, no args) and `scripts/run-android.sh <avd>` behave as before; `scripts/test-ios-functional.sh` with the compose stack up completes its walkthrough.
- Negative: `bash -c 'set -u; echo $UNSET_VAR'` style probe — running a modified script with a required env var deliberately unset now fails fast with a named-variable error instead of continuing.

## Risks & gotchas

- `-u` breaks scripts that *relied* on empty expansion — that's the migration cost; step 2 is mandatory, not optional. Test each script end-to-end before merging, on a machine with the Android SDK and Xcode present (these can't be validated in CI).
- `pipefail` can surface pre-existing silent failures (e.g. `grep` finding nothing returns 1 and now kills the pipe) — where a zero-match is legitimate, use `|| true` on that pipe stage explicitly with a comment.
- Scope note: `scripts/` shell files are infra tooling used by ios/android agents daily — announce the change in the changelog entry so a suddenly-failing script is recognized as fail-fast working as intended.
