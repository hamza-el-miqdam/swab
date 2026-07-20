# SUG-API-014 — Shutdown can hang forever: no close timeout, close errors unhandled, exit code always 0

- **Area:** backend
- **Topic:** correctness
- **Impact:** low
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** n/a (G3 operational hygiene)

## Problem / Opportunity

`apps/api/src/server.ts:10-15`:

```ts
const shutdown = (signal: string): void => {
  app.log.info({ signal }, "shutting down");
  void app.close().then(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
```

Three gaps:
1. **No deadline**: `app.close()` waits for in-flight requests; a stuck request (slow client on a 1.4 MB vault upload, wedged DB call) means the process never exits — in Docker/K8s it lingers until SIGKILL, and `docker compose stop` eats the full 10 s grace every time.
2. **Rejection path exits nothing**: if `close()` rejects, the `.then` never runs, no `process.exit`, and the rejection is only "handled" by the `void` — the process hangs with no log.
3. **Double-signal**: a second SIGTERM re-enters `shutdown` and calls `close()` again.
Also, `@repo/db`'s PrismaClient is never `$disconnect`ed on shutdown (`packages/db/src/index.ts:7` creates it; nothing closes it) — harmless for exit-based teardown but worth doing once a close hook exists.

## Implementation plan

1. Rewrite the handler in `/Users/mikedown/Workspace/Swab/apps/api/src/server.ts`:
   ```ts
   let shuttingDown = false;
   const shutdown = (signal: string): void => {
     if (shuttingDown) return;
     shuttingDown = true;
     app.log.info({ signal }, "shutting down");
     const deadline = setTimeout(() => {
       app.log.warn("close deadline exceeded, forcing exit");
       process.exit(1);
     }, 8_000);
     deadline.unref();
     app.close().then(
       () => process.exit(0),
       (err: unknown) => {
         app.log.error({ err: { message: err instanceof Error ? err.message : String(err) } }, "close failed");
         process.exit(1);
       },
     );
   };
   ```
   (8 s stays under Docker's default 10 s SIGKILL grace; `unref` so the timer never keeps the process alive on the happy path.)
2. Register a Prisma disconnect on app close — in `buildApp` is the wrong layer (it doesn't own Prisma); instead in `server.ts` after `buildApp`: `app.addHook("onClose", async () => { await prisma.$disconnect(); })` with `import { prisma } from "@repo/db";`.
3. `src/server.ts` is excluded from coverage (`apps/api/vitest.config.ts:13`) as boot wiring — extract the shutdown factory into `src/lib/shutdown.ts` (`createShutdown(app, exit: (code: number) => void, timeoutMs)`) so it becomes unit-testable pure-ish logic, and keep server.ts as two-line wiring.
4. Changelog entry (G5).

## Tests & acceptance criteria

New `apps/api/tests/shutdown.test.ts` (run: `pnpm --filter @repo/api test`), against `createShutdown` with a fake app (`{ log: {...}, close: vi.fn() }`) and fake `exit`:
- `"shutdown exits 0 when close resolves"`;
- `"shutdown exits 1 when close rejects"`;
- `"shutdown force-exits 1 when close exceeds the deadline"` — `vi.useFakeTimers()`, close returns a never-resolving promise, advance 8 s, assert `exit(1)`;
- `"second signal is a no-op"` — call twice, `close` called once.

## Risks & gotchas

- Keep the fatal-boot stderr path (`server.ts:20-24`) untouched — it exists for pre-logger failures.
- `process.exit` inside library code is a testability smell — that's why the exit fn is injected (step 3).
- If SUG-API-008's sweep timer lands, its `onClose` cleanup plus `unref()` already prevent it from blocking close — no interaction.
