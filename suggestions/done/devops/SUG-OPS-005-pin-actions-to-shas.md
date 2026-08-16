# SUG-OPS-005 — GitHub Actions pinned to mutable tags instead of commit SHAs

- **Area:** devops
- **Topic:** security
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G1 least privilege / supply chain; devops best practice "actions pinned to full commit SHAs")

## Problem / Opportunity

`.github/workflows/ci.yml:19-21` uses tag pins:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
```

Tags are mutable; a compromised action repo can retag `v4` to malicious code that then runs with access to the workflow's `GITHUB_TOKEN` and runner filesystem (the tj-actions/changed-files incident is the canonical example). The repo's own devops rules require "third-party actions pinned to full commit SHAs (not tags)" (`agents/devops-infrastructure-specialist.md`, Domain Best Practices). With Dependabot's `github-actions` ecosystem (SUG-OPS-004) keeping SHAs fresh, pinning has no maintenance downside.

## Implementation plan

1. For each `uses:` in `.github/workflows/ci.yml` (and any workflow added by other SUG-OPS items), resolve the current SHA of the major tag: `gh api repos/actions/checkout/git/ref/tags/v4.2.2 --jq .object.sha` (resolve the latest v4.x tag, then its commit SHA; annotated tags need one more deref via `git/tags/<sha>`).
2. Replace tag with SHA, keeping the human-readable version as a comment:

   ```yaml
   - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
   - uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda # v4.1.0
   - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
   ```
   (Do NOT copy these SHAs blindly — resolve them at implementation time; the comments must match the resolved SHA.)
3. Dependabot updates SHA-pinned actions and keeps the trailing `# vX.Y.Z` comment in sync automatically — no extra config needed beyond SUG-OPS-004.
4. Optional hardening in the same PR: set repository Actions policy to "Allow <owner> actions and select non-<owner> actions" listing only the pinned actions (Settings → Actions → General), and add `permissions: contents: read` to any new workflow by default (already present in `ci.yml:8-9`).
5. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- CI runs green with SHA pins (a wrong/nonexistent SHA fails immediately at job setup — instant feedback).
- `actionlint` clean.
- `grep -E "uses:.*@v[0-9]" .github/workflows/*.yml` returns nothing (all pinned).

## Risks & gotchas

- Annotated vs lightweight tags: resolving a tag ref can return a tag object SHA, not the commit SHA — always deref to the commit (workflows accept both, but Dependabot comment-sync expects commit SHAs).
- When other SUG-OPS PRs add workflows (security.yml, scope-guard.yml), coordinate so tag-pinned `uses:` don't creep back in; add the `grep` from acceptance criteria as a step in CI if drift recurs.
