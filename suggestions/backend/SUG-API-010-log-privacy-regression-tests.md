# SUG-API-010 — Nothing proves the logs are clean: add a log-capture regression test for phoneHash / OTP codes / vault bytes

- **Area:** backend
- **Topic:** privacy
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** VLT-03, IDT-01, IDT-03

## Problem / Opportunity

The privacy invariant's logging half ("never log: verbs of envies, recipient lists, vault contents, phone hashes, push tokens" — G3) is currently enforced only by comments and discipline:

- `apps/api/src/app.ts:24-26` — "phoneHashes stay out of the logs by construction"
- `apps/api/src/routes/auth.ts:44,84` — "never log phoneHash values", "user ids only"
- `apps/api/src/routes/vault.ts:38-39` — "byte length only — contents never touch the logs"

But the entire test suite runs with logging disabled (`apps/api/tests/helpers.ts:28` — `logger: false`), so **no test would catch a regression** that logs a phoneHash, a devCode, or blob bytes — e.g. someone adding `req.log.info({ body: req.body })` for debugging, or a future pino serializer change that starts including request bodies. For the project's product-defining invariant, this deserves a mechanical guard, and `buildApp` only needs a tiny extension to support capturing pino output.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts`, extend `AppDeps` (lines 12-19) with an optional sink:
   ```ts
   /** Test hook: capture pino output. Implies logging enabled at debug level. */
   logDestination?: { write(msg: string): void };
   ```
   and in the `Fastify()` options (lines 27-33), when `deps.logDestination` is set, use:
   ```ts
   logger: { level: "debug", stream: deps.logDestination,
             redact: { paths: ["req.headers.authorization"], censor: "[redacted]" } }
   ```
   (pino accepts any `{ write }` object as a destination stream; keep the existing `logger === false` and default branches unchanged.)
2. New test `apps/api/tests/log-privacy.test.ts`:
   ```ts
   const lines: string[] = [];
   const { app } = await makeApp({ logger: undefined, logDestination: { write: (m) => lines.push(m) } });
   ```
   (adjust `makeApp` in `tests/helpers.ts:22-31` so `logDestination` passes through and wins over `logger: false`).
3. Drive the full sensitive surface in one flow: OTP request (capture `devCode`), a failed verify (wrong code), successful verify with displayName, vault POST with `OPAQUE_BYTES`-style buffer, vault GET, one 404, one 401 (bad bearer token). Then assert over `lines.join("")`:
   - does NOT contain `PHONE_HASH_A` (the 64-char hash — helpers.ts:14);
   - does NOT contain the `devCode` value;
   - does NOT contain the blob's base64 string nor a distinctive byte-pattern substring;
   - does NOT contain the raw `Authorization` bearer token (the redact path at app.ts:32 should show `[redacted]` — assert the literal token string is absent);
   - does NOT contain the displayName (it is user content; currently never logged — lock that in);
   - DOES contain `"otp verified"`, `"vault written"`, `"vault read"` with `userId` fields (proves the capture works and IDs-only logging is intact).
4. Changelog entry (G5).

## Tests & acceptance criteria

- File: `apps/api/tests/log-privacy.test.ts`, test name: `"G3/VLT-03: full auth+vault flow logs contain no phoneHash, OTP code, token, displayName, or blob bytes"`.
- Run: `pnpm --filter @repo/api test`. Acceptance: test passes; temporarily adding `req.log.info({ phoneHash })` in `auth.ts` makes it fail (verify once locally, then revert — that's the point of the guard).

## Risks & gotchas

- Fastify serializes `req` on request-start lines at debug level (method, url, hostname) — request BODIES are not logged by pino-under-fastify by default; the test locks in that default against accidental custom serializers.
- Short strings can false-positive via substring collisions (e.g. a 6-digit devCode appearing inside a timestamp). Mitigate: assert on distinctive values — the 64-char hash is safe; for the devCode assert on `"devCode":"<code>"` and the standalone quoted string `"\"${code}\""`.
- Keep `logger: false` as the default for all other tests (noise/speed) — only this suite captures.
- This complements, not replaces, the repo-wide privacy audit (playbook §6).
