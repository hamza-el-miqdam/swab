# SUG-API-016 — Global error handler passes arbitrary internal error messages through as 4xx problem titles

- **Area:** backend
- **Topic:** security
- **Impact:** low
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** n/a (G1/G3 hygiene)

## Problem / Opportunity

`apps/api/src/app.ts:59-68`:

```ts
app.setErrorHandler((err: unknown, req, reply) => {
  const e = err instanceof Error ? (err as Error & { statusCode?: unknown; code?: unknown }) : null;
  const status = typeof e?.statusCode === "number" ? e.statusCode : 500;
  ...
  sendProblem(reply, status, status >= 500 || e === null ? "Internal Server Error" : e.message);
});
```

For any error carrying a 4xx `statusCode`, the raw `e.message` becomes the problem `title` verbatim. Today that means Fastify's internal content-type-parser errors reach clients unfiltered, and some of them **reflect client input**: `FST_ERR_CTP_INVALID_MEDIA_TYPE`'s message embeds the client-supplied `Content-Type` header value ("Unsupported Media Type: <whatever the client sent>"), contradicting the file's own comment at `app.ts:60` ("request bodies are never echoed into errors") in spirit — headers are input too (G1), and the handler's contract should be an allowlist, not "whatever message the throwing layer produced". It also means any future plugin or handler that throws a 4xx-tagged error with an internal detail string (query text, file path) ships that string to clients by default. Additionally, `title` semantics drift: RFC 7807 wants a short, stable, human-readable summary per error type, not free-form messages — clients keying UI copy off `title` will break when a dependency rewords a message.

Also, unlike 5xx (`app.ts:64-66`), 4xx errors from this path are never logged even at debug — a malformed-body storm is invisible in logs (rate metrics from SUG-API-009 mitigate, but a debug line is cheap).

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts`, map known Fastify error codes to fixed titles and default everything else to the generic status text:
   ```ts
   const KNOWN_4XX_TITLES: Record<string, string> = {
     FST_ERR_CTP_EMPTY_JSON_BODY: "Invalid request body",
     FST_ERR_CTP_INVALID_MEDIA_TYPE: "Unsupported Media Type",
     FST_ERR_CTP_BODY_TOO_LARGE: "Payload Too Large",
     FST_ERR_VALIDATION: "Invalid request", // future-proofing for SUG-API-007's schema validation
   };
   ```
   and in the handler:
   ```ts
   const code = typeof e?.code === "string" ? e.code : "";
   const title =
     status >= 500 || e === null
       ? "Internal Server Error"
       : KNOWN_4XX_TITLES[code] ?? "Request Error";
   if (status >= 500) {
     req.log.error({ err: { message: e?.message, code: e?.code } }, "request failed");
   } else {
     req.log.debug({ err: { code: e?.code }, status }, "request rejected");
   }
   sendProblem(reply, status, title);
   ```
   Fastify's JSON-parse failure (`Body is not valid JSON...` / SyntaxError with statusCode 400) has no stable single code across versions — it falls into the `"Request Error"` default, which is fine.
2. Note: route-level `sendProblem` calls (400/401/409/413/422 in `routes/*.ts`) bypass this handler and keep their precise titles — this change only affects errors that *throw* into the handler.
3. Changelog entry (G5) — clients matching on 4xx titles from thrown errors (unlikely; the route-level problems are unchanged) should be called out.

## Tests & acceptance criteria

In `apps/api/tests/health.test.ts` (or a new `error-handler.test.ts`; run: `pnpm --filter @repo/api test`):
- `"G1: an unsupported content-type is rejected without echoing the header value"` — inject `POST /auth/otp/request` with `headers: { "content-type": "application/x-evil-reflected" }` and a raw payload string; assert 415, `application/problem+json`, and that the response body does NOT contain `"x-evil-reflected"`.
- `"G1: malformed JSON body → 400 problem with a generic title"` — inject `POST /auth/otp/request` with `content-type: application/json` and payload `"{nope"`; assert 400 and `title` is `"Request Error"` (not a `SyntaxError` message).
- `"G3: an oversized body → 413 problem"` — payload > 2 MB (`app.ts:39` bodyLimit); assert 413 with the fixed title.

## Risks & gotchas

- Keep `detail` omitted for these paths — the titles are deliberately information-poor; debugging happens via `requestId` + logs (the problem body already carries `requestId`, `lib/problem.ts:23`).
- Don't touch the 429 path — `@fastify/rate-limit` uses its own `errorResponseBuilder` (`app.ts:47-52`) and never reaches this handler.
- When SUG-API-007 lands, its Zod-validation branch must be checked BEFORE this generic mapping so validation failures keep field-path details.
