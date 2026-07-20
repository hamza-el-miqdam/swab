# SUG-OPS-009 — Turborepo cache is cold on every CI run (no cache persistence, no affected-only filtering)

- **Area:** devops
- **Topic:** caching
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (devops best practice "pnpm + Turbo caches keyed on lockfile")

## Problem / Opportunity

`.github/workflows/ci.yml` caches only the pnpm store (`ci.yml:21-24`, `setup-node` with `cache: pnpm`). The Turborepo local cache (`.turbo/cache`) is never persisted and no remote cache is configured, so `pnpm turbo run lint typecheck test build` (`ci.yml:28`) rebuilds every package from scratch on every run — the "Turborepo-cached" pipeline required by the devops agent's own best practices (`agents/devops-infrastructure-specialist.md`: "pnpm + Turbo caches keyed on lockfile", "affected-only execution") doesn't exist. `turbo.json` is cache-ready (task outputs declared at `turbo.json:6-9`; only `db:generate` is deliberately `cache: false` at `turbo.json:5`), so this is pure CI wiring.

## Implementation plan

1. Edit `.github/workflows/ci.yml`, add an `actions/cache` step before the turbo run (after checkout):

   ```yaml
   - name: Turborepo cache
     uses: actions/cache@v4        # pin to SHA per SUG-OPS-005
     with:
       path: .turbo/cache
       key: turbo-${{ runner.os }}-${{ github.sha }}
       restore-keys: |
         turbo-${{ runner.os }}-
   ```
   (Per-SHA key with prefix restore is the standard turbo pattern: always restores the newest cache, always saves a fresh one.)
2. Point turbo at that dir explicitly: change `ci.yml:28` to
   ```yaml
   - run: pnpm turbo run lint typecheck test build --cache-dir=.turbo/cache --summarize
   ```
3. Add a cache-visibility line to the job summary (pairs with SUG-OPS-012's summary step; devops project rule 5 wants cache hit rate reported):
   ```yaml
   - name: Cache stats to summary
     if: always()
     run: |
       ls .turbo/runs/*.json >/dev/null 2>&1 && node -e "const s=require('fs').readdirSync('.turbo/runs').map(f=>require('./.turbo/runs/'+f)).pop(); const t=s.execution.attempted, c=s.tasks.filter(x=>x.cache.status==='HIT').length; require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, \`Turbo cache: \${c}/\${t} hits\n\`)" || true
   ```
   (Or simply grep turbo's "cached" line from output — keep it trivial.)
4. Defer turbo **remote** cache (Vercel remote cache is free but adds a token secret; a self-hosted S3 cache fights the free tier) — the actions/cache approach costs nothing and needs no secrets. Note the trade-off in the PR.
5. Optional in same PR: affected-only on PRs — `--filter="...[origin/main]"` requires `fetch-depth: 0` on checkout (`ci.yml:19` currently shallow). With only 3 JS packages today the win is small; the cache step above already gives most of the speedup. Flag as follow-up if skipped.
6. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- First CI run after merge: cache saved (check "Post Turborepo cache" step).
- Second run with no package changes: turbo output shows `FULL TURBO` / all tasks "cached"; wall time for the turbo step drops substantially.
- Changing only `apps/api/src` re-runs api tasks but restores `packages/db`/`packages/ui` from cache.

## Risks & gotchas

- Test caching correctness: `test` depends on `^db:generate` (`turbo.json:13`) which is `cache: false` — generation still runs each time (correct, Prisma client is a build input). Do NOT be tempted to cache `db:generate`.
- Coverage thresholds live inside vitest (`apps/api/vitest.config.ts:14`), so a cached-green `test` task is one whose coverage already passed — safe. But `test` declares no `outputs` (`turbo.json:13`), so `coverage/` isn't replayed on cache hits; if a later SUG wires coverage upload, add `"outputs": ["coverage/**"]` to the `test` task then.
- GitHub caches are branch-scoped: PR branches can read `main`'s caches but not siblings' — expect cold-ish first runs on new branches; that's normal.
- 10 GB repo cache cap: turbo artifacts are small; the restore-key pattern naturally rotates old entries out.
