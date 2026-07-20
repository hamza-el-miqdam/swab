# SUG-OPS-014 — docker-compose: API has no healthcheck, all ports bind on every interface, .env.example creds mismatch

- **Area:** devops
- **Topic:** docker
- **Impact:** low
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G1 least privilege; G3 health endpoints)

## Problem / Opportunity

1. **No healthcheck on the `api` service.** `docker-compose.yml:29-53` defines the API with no `healthcheck:` block, even though the service exposes `GET /health` (G3; used by the E2E preflight at `scripts/e2e-ios.sh:10` and `scripts/e2e-android.sh:12`). The `db` and `adminer` services both gate on `service_healthy` (`docker-compose.yml:40-42`, `65-67`), but nothing can ever gate on the API being *actually up* — `docker compose up -d && scripts/e2e-android.sh` races the API boot (schema push + tsx start, `docker-compose.yml:46`) and fails with the "API not reachable" error intermittently.
2. **Ports bound on 0.0.0.0.** `docker-compose.yml:19-20` (`"5432:5432"`), `:38-39` (`"3001:3001"`), `:63-64` (`"8080:8080"`) publish Postgres, the dev API (with its known dev `JWT_SECRET`, `docker-compose.yml:35`), and Adminer (full DB CRUD UI, explicitly "Dev-stack only … G1" per `docker-compose.yml:57`) to every interface — on a laptop on café/co-working Wi-Fi, anyone on the LAN can hit them. Exception: the API port may legitimately need LAN exposure for testing on a *physical* phone; the simulator/emulator flows use localhost.
3. **`.env.example` doesn't match the documented dev stack.** `apps/api/.env.example:2` and `packages/db/.env.example:2` say `postgresql://postgres:postgres@localhost:5432/swab`, but the compose Postgres is `swab:swab_local_dev` (`docker-compose.yml:16-18`). A dev copying `.env.example` to run the API outside Docker against the compose DB gets auth failures (G5: code and docs shouldn't disagree).

## Implementation plan

1. Add to the `api` service in `docker-compose.yml`:
   ```yaml
   healthcheck:
     test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
     interval: 5s
     timeout: 3s
     retries: 30
     start_period: 20s
   ```
   (curl/wget are not in `node:22-slim`; Node's global fetch is — `apps/api/Dockerfile:8`. Generous retries because first boot includes `prisma db push`, `docker-compose.yml:46`.)
2. Bind loopback-only where LAN access is never needed:
   ```yaml
   db:      ports: ["127.0.0.1:5432:5432"]
   adminer: ports: ["127.0.0.1:8080:8080"]
   ```
   Leave the API at `"3001:3001"` with a comment: exposed on the LAN deliberately so a physical phone can reach it during on-device testing; simulator/emulator use localhost.
3. Fix both `.env.example` files to the compose creds with the existing placeholder disclaimer retained:
   `DATABASE_URL=postgresql://swab:swab_local_dev@localhost:5432/swab`
4. Root `CHANGELOG.md` entry (mention the healthcheck so agents can now use `docker compose up --build --wait`).

## Tests & acceptance criteria

- `docker compose up --build --wait` returns only when the API answers `/health` (exit 0), then `curl -f localhost:3001/health` passes.
- `docker compose ps` shows `api (healthy)`.
- From another machine on the LAN: port 5432/8080 refused, 3001 reachable.
- Copy `apps/api/.env.example` → `.env`, run `pnpm --filter @repo/api dev` on the host against compose Postgres: connects.

## Risks & gotchas

- Anyone with muscle-memory `psql -h <laptop-LAN-ip>` workflows loses remote DB access — that's the point; document the override (`docker compose -f docker-compose.yml -f compose.lan.yml up`) only if someone actually needs it.
- `--wait` semantics: services without healthchecks count as started; after this change `up -d` alone still doesn't block — E2E scripts keep their own preflight (correct defense in depth).
- Compose `develop.watch` (`docker-compose.yml:47-53`) is unaffected by healthchecks.
