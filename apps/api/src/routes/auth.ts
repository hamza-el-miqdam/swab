import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import type { Repository } from "../repo.js";
import { OTP_TTL_SECONDS, type OtpStore } from "../otp-store.js";
import { signJwt } from "../lib/jwt.js";
import { sendProblem, zodDetail } from "../lib/problem.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 3600;

// Client-side salted hash of the E.164 number (IDT-01) — hex/base64url shaped.
// The raw number must never reach the API.
const phoneHashSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "must be a hash, not a phone number");

const otpRequestSchema = z.object({ phoneHash: phoneHashSchema });

const otpVerifySchema = z.object({
  phoneHash: phoneHashSchema,
  code: z.string().regex(/^\d{6}$/, "must be a 6-digit code"),
  displayName: z.string().trim().min(1).max(50).optional(),
});

export interface AuthRouteDeps {
  env: Env;
  repo: Repository;
  otpStore: OtpStore;
}

// IDT-03: a stricter per-IP tier on top of the global 100/min bucket (app.ts) —
// one IP spraying OTP requests across many phoneHashes stays well under the
// per-hash throttle (OtpStore) but must not be free; this caps it long before
// the global limit would (and before OQ-IDT-1's SMS spend / SUG-API-008's
// per-hash state growth get a chance to matter).
const otpRateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const { env, repo, otpStore } = deps;

  app.post("/auth/otp/request", { config: otpRateLimit }, async (req, reply) => {
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }
    const result = otpStore.request(parsed.data.phoneHash);
    if (!result.ok) {
      // G3: never log phoneHash values — event only.
      req.log.warn("otp request throttled");
      return sendProblem(reply, 429, "Too many OTP requests", "Retry later.", {
        retryAfterMs: result.retryAfterMs,
      });
    }
    req.log.info("otp code issued");
    // POC (OQ-IDT-1): no SMS provider yet — the code is returned to the caller
    // only when explicitly opted in via OTP_DEV_CODE (fail-closed; boot refuses
    // this flag in production — see env.ts), so the flow is exercisable
    // end-to-end in dev/test. In production this field is absent and delivery is via SMS.
    return reply.code(200).send({
      sent: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(env.OTP_DEV_CODE === "enabled" ? { devCode: result.code } : {}),
    });
  });

  app.post("/auth/otp/verify", { config: otpRateLimit }, async (req, reply) => {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }
    const { phoneHash, code, displayName } = parsed.data;

    if (!otpStore.check(phoneHash, code)) {
      return sendProblem(reply, 401, "Invalid or expired code");
    }

    let user = await repo.findUserByPhoneHash(phoneHash);
    let isNewUser = false;
    if (user === null) {
      if (displayName === undefined) {
        // Code stays valid (not consumed) — the client retries with displayName.
        return sendProblem(reply, 422, "displayName required", "First sign-in must include displayName.");
      }
      user = await repo.createUser(phoneHash, displayName);
      isNewUser = true;
    }
    otpStore.consume(phoneHash); // single-use (IDT-03)

    // G3: user ids only, never phoneHash.
    req.log.info({ userId: user.id, isNewUser }, "otp verified");
    return reply.code(200).send({
      userId: user.id,
      isNewUser,
      accessToken: signJwt({ sub: user.id, type: "access" }, env.JWT_SECRET, ACCESS_TTL_SECONDS),
      refreshToken: signJwt({ sub: user.id, type: "refresh" }, env.JWT_SECRET, REFRESH_TTL_SECONDS),
    });
  });
}
