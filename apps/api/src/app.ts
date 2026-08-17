import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import type { Env } from "./env.js";
import type { DbHealthCheck, Repository } from "./repo.js";
import { OtpStore } from "./otp-store.js";
import { sendProblem } from "./lib/problem.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerVaultRoutes } from "./routes/vault.js";

// Accept forwarded request IDs only when ID-shaped (G1: headers are input too).
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
// ...and never verbatim. `randomUUID()` output itself satisfies REQUEST_ID_RE,
// so an unauthenticated caller could otherwise supply a *server-shaped* id —
// replaying one harvested from the echoed `x-request-id` header to interleave
// its log lines under a victim's trace, or pinning one constant across all
// traffic to collapse `reqId` as a forensic key (G3). Namespacing keeps the
// correlation benefit while making client-chosen ids self-evident in the logs.
const CLIENT_REQUEST_ID_PREFIX = "client-";

// RFC 7807 wants a short, stable title per error type — not a passthrough of
// whatever message the throwing layer produced (SUG-API-016). Only Fastify's
// content-type-parser codes are known-safe today; everything else defaults
// to a generic title in the error handler below.
const KNOWN_4XX_TITLES: Record<string, string> = {
  FST_ERR_CTP_EMPTY_JSON_BODY: "Invalid request body",
  FST_ERR_CTP_INVALID_MEDIA_TYPE: "Unsupported Media Type",
  FST_ERR_CTP_BODY_TOO_LARGE: "Payload Too Large",
};

// @fastify/rate-limit does `throw errorResponseBuilder(req, context)` — it does
// not serialize the return value itself — so the builder must hand back a real
// Error, or the generic handler below can't recognize it (`instanceof Error`
// fails on a plain object) and mislabels a 429 as a 500 (found while adding
// SUG-API-005's tests: the global limiter's 429 path had never been exercised).
class RateLimitProblem extends Error {
  readonly statusCode = 429;
}

export interface AppDeps {
  env: Env;
  repo: Repository;
  dbHealth: DbHealthCheck;
  otpStore?: OtpStore;
  /** Set false in tests to silence logs. */
  logger?: boolean;
}

/** Testable factory (exercised via app.inject() — backend rule 7). */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    // G3: structured pino JSON logs; every line carries the requestId (fastify
    // `reqId`). Request/response bodies are never logged — vault blobs and
    // phoneHashes stay out of the logs by construction.
    logger:
      deps.logger === false
        ? false
        : {
            level: deps.env.NODE_ENV === "production" ? "info" : "debug",
            redact: { paths: ["req.headers.authorization"], censor: "[redacted]" },
          },
    genReqId: (req) => {
      const incoming = req.headers["x-request-id"];
      return typeof incoming === "string" && REQUEST_ID_RE.test(incoming)
        ? `${CLIENT_REQUEST_ID_PREFIX}${incoming}`
        : randomUUID();
    },
    // Vault blob is ≤1 MB raw; base64 adds ~33%, plus JSON envelope headroom.
    bodyLimit: 2 * 1024 * 1024,
    // IDT-03: trust exactly N `X-Forwarded-For` hops so `req.ip` (the rate-limit
    // key) is the real client, not the proxy — `false` when directly exposed
    // (default) so a spoofed header can't buy a client a fresh bucket.
    trustProxy: deps.env.TRUST_PROXY_HOPS > 0 ? deps.env.TRUST_PROXY_HOPS : false,
  });

  // Per-IP limit on all public endpoints (IDT-03). The stricter per-phoneHash
  // OTP throttle lives in OtpStore, where the key is available post-parse.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, context) =>
      new RateLimitProblem(`Rate limit exceeded, retry in ${context.after}.`),
  });

  // G3: always echo the correlation id, not just on problem bodies, so clients
  // can correlate success responses with logs too.
  app.addHook("onSend", async (req, reply) => {
    void reply.header("x-request-id", req.id);
  });

  app.setNotFoundHandler((req, reply) => {
    sendProblem(reply, 404, "Not Found", `${req.method} ${req.url} does not exist.`);
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    // RFC 7807 everywhere; request bodies are never echoed into errors (G1/G3).
    if (err instanceof RateLimitProblem) {
      req.log.debug("request rate-limited");
      return sendProblem(reply, 429, "Too Many Requests", err.message);
    }
    // Fastify 5.9 types err as unknown — narrow before touching FastifyError fields.
    const e = err instanceof Error ? (err as Error & { statusCode?: unknown; code?: unknown }) : null;
    const status = typeof e?.statusCode === "number" ? e.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err: { message: e?.message, code: e?.code } }, "request failed");
    } else {
      // Debug-only: a malformed-request storm is otherwise invisible in logs.
      req.log.debug({ err: { code: e?.code }, status }, "request rejected");
    }
    // The title is an allowlist, not "whatever message the throwing layer
    // produced" — an internal error string (or, for content-type-parser
    // errors specifically, one that can embed client input) must never reach
    // clients verbatim as an RFC 7807 title. Route-level sendProblem calls
    // bypass this handler entirely and keep their own precise titles.
    const code = typeof e?.code === "string" ? e.code : "";
    const title =
      status >= 500 || e === null ? "Internal Server Error" : (KNOWN_4XX_TITLES[code] ?? "Request Error");
    sendProblem(reply, status, title);
  });

  const otpStore = deps.otpStore ?? new OtpStore();
  registerHealthRoutes(app, { dbHealth: deps.dbHealth });
  registerAuthRoutes(app, { env: deps.env, repo: deps.repo, otpStore });
  registerVaultRoutes(app, { env: deps.env, repo: deps.repo });

  return app;
}
