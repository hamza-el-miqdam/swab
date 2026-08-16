# SUG-API-012 — Client-supplied x-request-id is trusted unvalidated (G1 says validate ALL headers)

- **Area:** backend
- **Topic:** security
- **Impact:** low
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** n/a (G1, G3)

## Problem / Opportunity

`apps/api/src/app.ts:34-37`:

```ts
genReqId: (req) => {
  const incoming = req.headers["x-request-id"];
  return typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
},
```

Any non-empty string is accepted as the request ID, which is then stamped on **every log line** (G3) and echoed back in every RFC 7807 body (`apps/api/src/lib/problem.ts:23`). Consequences:

- A client can send a multi-kilobyte header and inflate every log record for that request (log-volume abuse); pino JSON-escapes newlines so classic log-line injection is neutralized, but size is unbounded (Node's default header cap is 16 KB — per line, on every log statement).
- Spoofable correlation: an attacker can reuse another request's ID (or a constant) to muddy incident forensics — IDs should be accepted only when they look like IDs.
- G1 explicitly lists headers among the boundaries to validate; this is the only header the app consumes besides `authorization` (validated in `apps/api/src/lib/auth.ts:15-17`).

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts`, constrain the accepted shape (module-level constant next to the imports):
   ```ts
   // Accept forwarded request IDs only when ID-shaped (G1: headers are input too).
   const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
   ```
   and in `genReqId`:
   ```ts
   return typeof incoming === "string" && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
   ```
2. While here, return the ID to callers on success responses too (today only problem bodies carry it): add
   ```ts
   app.addHook("onSend", async (req, reply) => { void reply.header("x-request-id", req.id); });
   ```
   so clients can always correlate (small, standard, and makes the E2E scripts' failure triage easier).
3. Changelog entry (G5).

## Tests & acceptance criteria

In `apps/api/tests/health.test.ts` (it already covers requestId in problems, line 41-47) add:
- `"G1/G3: a well-formed x-request-id is honored and echoed"` — inject `GET /nope` with header `x-request-id: e2e-abc_1.2`; assert the problem body's `requestId === "e2e-abc_1.2"` and the response header matches.
- `"G1: an over-long or malformed x-request-id is replaced with a generated UUID"` — inject with a 300-char header value and with `"bad id!\n"`; assert `requestId` matches `/^[0-9a-f-]{36}$/` and does not contain the supplied value.
- `"G3: success responses carry x-request-id"` — `GET /health`, assert the header is present.

Run: `pnpm --filter @repo/api test`.

## Risks & gotchas

- Pick the charset to match what the mobile clients / E2E harness actually send (grep `x-request-id` in `apps/ios`, `apps/android`, `scripts/` before finalizing the regex; if nothing sends one yet, the strict regex is free).
- Keep `randomUUID` as the fallback, never reject the request — a bad correlation header must not break a client.
- The `onSend` hook must not overwrite an existing header of the same name set by future middleware (Fastify `reply.header` overwrites — fine today; note it).
