# Changelog archive — 2026-08-17

## 2026-08-17 — [scope-guard] `suggestions/**` is allowed from any area

- `suggestions/README.md` requires an implemented suggestion to move to `done/<area>/` and the open/done counts to be updated — bookkeeping every area owes on its own PR, on a tree no area prefix owns. The guard rejected exactly that diff, so the duty was unsatisfiable and the moves silently never happened: PRs #76/#77/#78 all left their suggestion sitting in the open folder.
- Moved `suggestions/` into `SHARED_ALLOWED_PREFIXES`, next to `pnpm-lock.yaml` and `docs/STATUS.md` — same category: files every area must touch, owned by none.
- Only the *path* is shared; a PR still has to be reviewed on its contents. 2 new cases (one `area:db`, one `area:backend`, to pin that the allowance isn't area-specific), 22/22 pass — verified red before green.

## 2026-08-17 — [scope-guard] `pnpm-lock.yaml` is allowed from any area

- Adding a dependency to **any** package rewrites the workspace lockfile, and no area prefix owns it — so every dependency-adding PR failed the scope check unless it also carried `area:sre`. G4 allows new dependencies with justification; the guard was rejecting the diff that justification necessarily produces.
- Moved `pnpm-lock.yaml` into `SHARED_ALLOWED_PREFIXES`, next to `docs/STATUS.md` and `docs/qa/` — the same category: files every area must touch, owned by none.
- **The root `package.json` deliberately stays `area:sre`.** Workspace-level `pnpm.overrides` and shared devDependencies are still an infra decision; only the lockfile is shared. Pinned by a test.
- Found by #74 (`area:db`), which adds a dev-only test runner. 2 new cases, 20/20 pass.
