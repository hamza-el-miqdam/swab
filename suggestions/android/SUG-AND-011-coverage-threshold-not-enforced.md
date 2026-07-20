# SUG-AND-011 — G2's 80% coverage floor is reported but never enforced: no JacocoCoverageVerification gate

- **Area:** android
- **Topic:** testing
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** n/a (G2 global directive)

## Problem / Opportunity

G2 (agents/_global-directives.md, "Minimum 80% line coverage on changed packages, **enforced in CI** … threshold configured in each package") is only half-implemented for Android. /Users/mikedown/Workspace/Swab/apps/android/app/build.gradle.kts:171-189 registers `jacocoDomainCoverage` — a `JacocoReport` task that *generates* XML/HTML — but there is no `JacocoCoverageVerification` task anywhere in the file, so nothing fails when coverage drops below 80%. The high numbers quoted in the changelog (98.32% at apps/android/CHANGELOG.md:25) are self-reported from manual runs; a PR that halves coverage would pass every configured gate.

The exclusion list (`domainCoverageExcludes`, build.gradle.kts:158-169) already defines the honest measurable scope (domain code, no UI/platform glue), so adding the verification gate is mechanical.

## Implementation plan

1. In `apps/android/app/build.gradle.kts`, alongside `jacocoDomainCoverage` (reuse its exact `classDirectories`/`sourceDirectories`/`executionData` wiring, lines 181-188):
   ```kotlin
   tasks.register<JacocoCoverageVerification>("jacocoDomainCoverageVerification") {
       dependsOn("testDebugUnitTest")
       group = "verification"
       description = "Fails if Wave-1 domain line coverage < 80% (G2)."
       classDirectories.setFrom(files(classDir).asFileTree.matching { exclude(domainCoverageExcludes) })
       sourceDirectories.setFrom(files("src/main/kotlin"))
       executionData.setFrom(files(layout.buildDirectory.file("jacoco/testDebugUnitTest.exec")))
       violationRules {
           rule {
               limit {
                   counter = "LINE"
                   value = "COVEREDRATIO"
                   minimum = "0.80".toBigDecimal()
               }
           }
       }
   }
   ```
   Hoist `val classDir = layout.buildDirectory.dir("tmp/kotlin-classes/debug")` (currently local inside the report task, line 181) to file scope so both tasks share it.
2. Wire it into the standard lifecycle so it cannot be skipped: `tasks.named("check") { dependsOn("jacocoDomainCoverageVerification") }`.
3. CI: apps/android is outside the turbo pipeline (apps/android/build.gradle.kts:1-2). Locate the Android CI workflow under .github/workflows; if its Gradle invocation is `./gradlew test` (which includes `check` dependencies only when `check` itself runs), change it to `./gradlew check` or add the verification task explicitly. If no Android CI workflow exists yet, note that in the PR and coordinate with the devops-specialist (workflow files are area:sre scope — do not edit .github/workflows yourself; open the issue).
4. CHANGELOG entry (G5) documenting the new hard gate and how to read a failure (`build/reports/jacoco/jacocoDomainCoverage/html/index.html`).

## Tests & acceptance criteria

- `cd apps/android && ./gradlew jacocoDomainCoverageVerification` passes on current main (coverage is ~98% per CHANGELOG, far above floor).
- Negative check (manual, one-off, do not commit): temporarily add an uncovered branch-heavy dummy object under `src/main/kotlin/com/swab/android/vault/` and confirm the task fails with the violation message; revert.
- `./gradlew check` runs the verification (visible in `--dry-run` output).

## Risks & gotchas

- Keep the exclusions list shared (single `domainCoverageExcludes` val) so report and gate can never disagree about scope.
- `tmp/kotlin-classes/debug` is AGP-version-sensitive (pinned AGP 8.5.2, apps/android/build.gradle.kts:4); if AGP is ever bumped and the path moves, both tasks break together — loudly, which is fine.
- Threshold applies to the domain scope only; UI remains excluded by documented decision (build.gradle.kts:152-157). Do not silently widen scope in the same PR — that's a separate conversation.
