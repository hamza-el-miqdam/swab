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
      return typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    },
    // Vault blob is ≤1 MB raw; base64 adds ~33%, plus JSON envelope headroom.
    bodyLimit: 2 * 1024 * 1024,
  });

  // Per-IP limit on all public endpoints (IDT-03). The stricter per-phoneHash
  // OTP throttle lives in OtpStore, where the key is available post-parse.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, context) => ({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: `Rate limit exceeded, retry in ${context.after}.`,
    }),
  });

  app.setNotFoundHandler((req, reply) => {
    sendProblem(reply, 404, "Not Found", `${req.method} ${req.url} does not exist.`);
  });

  app.setErrorHandler((err, req, reply) => {
    // RFC 7807 everywhere; request bodies are never echoed into errors (G1/G3).
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err: { message: err.message, code: err.code } }, "request failed");
    }
    sendProblem(reply, status, status >= 500 ? "Internal Server Error" : err.message);
  });

  const otpStore = deps.otpStore ?? new OtpStore();
  registerHealthRoutes(app, { dbHealth: deps.dbHealth });
  registerAuthRoutes(app, { env: deps.env, repo: deps.repo, otpStore });
  registerVaultRoutes(app, { env: deps.env, repo: deps.repo });

  return app;
}
