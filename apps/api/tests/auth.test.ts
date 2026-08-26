import { describe, expect, it } from "vitest";
import { makeApp, PHONE_HASH_A, PHONE_HASH_B, signup, testEnv, type TokenPair } from "./helpers.js";
import { OTP_RATE_LIMITS } from "../src/routes/auth.js";

describe("POST /auth/otp/request + POST /auth/otp/verify", () => {
  it("IDT-01: signup happy path — OTP request then verify creates the user and returns a token pair", async () => {
    const { app, repo } = await makeApp();

    const requested = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    expect(requested.statusCode).toBe(200);
    const body = requested.json<{ sent: boolean; expiresInSeconds: number; devCode: string }>();
    expect(body.sent).toBe(true);
    expect(body.expiresInSeconds).toBe(300); // ≤5 min validity (IDT-03)
    expect(body.devCode).toMatch(/^\d{6}$/);

    const verified = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: body.devCode, displayName: "Amina" },
    });
    expect(verified.statusCode).toBe(200);
    const tokens = verified.json<TokenPair>();
    expect(tokens.isNewUser).toBe(true);
    expect(tokens.userId).toBeTruthy();
    expect(tokens.accessToken.split(".")).toHaveLength(3);
    expect(tokens.refreshToken.split(".")).toHaveLength(3);
    expect(repo.users.size).toBe(1);
  });

  it("IDT-01: returning user logs in with a fresh OTP and no displayName", async () => {
    const { app, repo } = await makeApp();
    const first = await signup(app, PHONE_HASH_A, "Amina");

    const requested = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    const { devCode } = requested.json<{ devCode: string }>();
    const verified = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: devCode },
    });
    expect(verified.statusCode).toBe(200);
    const tokens = verified.json<TokenPair>();
    expect(tokens.isNewUser).toBe(false);
    expect(tokens.userId).toBe(first.userId);
    expect(repo.users.size).toBe(1); // no duplicate account
  });

  it("IDT-01: concurrent createUser calls for the same phoneHash settle to one user, not a crash", async () => {
    // Exercises the race directly against the repo double: a double-tap,
    // client retry, or two devices can both pass findUserByPhoneHash → null
    // then race into createUser (fastify.inject() serializes full request
    // completion, including OTP consumption, so this race can't be
    // reproduced end-to-end through the route — see prisma-repo's P2002
    // handling in prisma-repo-error-mapping.test.ts for the production path).
    const { repo } = await makeApp();

    const [a, b] = await Promise.all([
      repo.createUser(PHONE_HASH_A, "Amina"),
      repo.createUser(PHONE_HASH_A, "Amina"),
    ]);

    expect(a.id).toBe(b.id);
    expect(repo.users.size).toBe(1);
  });

  it("IDT-03: wrong codes are rejected and correct codes are single-use", async () => {
    const { app } = await makeApp();
    const requested = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    const { devCode } = requested.json<{ devCode: string }>();
    const wrongCode = devCode === "000000" ? "000001" : "000000";

    const wrong = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: wrongCode, displayName: "Amina" },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: devCode, displayName: "Amina" },
    });
    expect(ok.statusCode).toBe(200);

    const replay = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: devCode },
    });
    expect(replay.statusCode).toBe(401); // consumed — single-use
  });

  it("IDT-03: OTP requests are throttled per phoneHash (4th request in window → 429 problem)", async () => {
    const { app } = await makeApp();
    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phoneHash: PHONE_HASH_A },
      });
      expect(res.statusCode).toBe(200);
    }

    const throttled = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    expect(throttled.statusCode).toBe(429);
    expect(throttled.headers["content-type"]).toContain("application/problem+json");
    const problem = throttled.json<{ status: number; title: string; retryAfterMs: number }>();
    expect(problem.status).toBe(429);
    expect(problem.retryAfterMs).toBeGreaterThan(0);

    // Throttle is per phoneHash — a different hash is unaffected.
    const other = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_B },
    });
    expect(other.statusCode).toBe(200);
  });

  it("IDT-01/G1: malformed bodies are rejected with an RFC 7807 problem and no user is created", async () => {
    const { app, repo } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: "+33612345678" }, // raw E.164 must never be accepted
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json<{ status: number }>().status).toBe(400);
    expect(repo.users.size).toBe(0);
  });

  it("IDT-01: first sign-in without displayName is rejected 422", async () => {
    const { app } = await makeApp();
    const requested = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    const { devCode } = requested.json<{ devCode: string }>();
    const verified = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: devCode },
    });
    expect(verified.statusCode).toBe(422);
    expect(verified.headers["content-type"]).toContain("application/problem+json");

    // The code was NOT consumed by the 422 — retrying with displayName succeeds.
    const retried = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: devCode, displayName: "Amina" },
    });
    expect(retried.statusCode).toBe(200);
  });

  it("IDT-03/G1: devCode is absent unless OTP_DEV_CODE is explicitly enabled", async () => {
    const { app } = await makeApp({ env: { ...testEnv, OTP_DEV_CODE: "disabled" } });
    const requested = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    expect(requested.statusCode).toBe(200);
    const body = requested.json<{ sent: boolean; devCode?: string }>();
    expect(body.devCode).toBeUndefined();
  });
});

// Distinct, valid-shaped phoneHashes so each request stays well under OtpStore's
// per-hash throttle (3 per 5 min) — these tests are exercising the per-IP tier.
function phoneHash(n: number): string {
  return `h${n}`.padEnd(64, "0");
}

describe("POST /auth/otp/* — per-IP rate limit tier (SUG-API-005, IDT-03)", () => {
  it("stricter per-IP limit trips at the 11th request in a minute, well under the global 100/min ceiling", async () => {
    const { app } = await makeApp();

    for (let i = 0; i < 10; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phoneHash: phoneHash(i) },
      });
      expect(res.statusCode).toBe(200);
    }

    const eleventh = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: phoneHash(10) },
    });
    expect(eleventh.statusCode).toBe(429);
    expect(eleventh.headers["content-type"]).toContain("application/problem+json");
  });

  it("TRUST_PROXY_HOPS=0 (default): X-Forwarded-For is ignored — rotating it does not evade the shared bucket", async () => {
    const { app } = await makeApp({ env: { ...testEnv, TRUST_PROXY_HOPS: 0 } });

    for (let i = 0; i < 10; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phoneHash: phoneHash(i) },
        headers: { "x-forwarded-for": `10.0.0.${i}` },
      });
      expect(res.statusCode).toBe(200);
    }

    const eleventh = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: phoneHash(10) },
      headers: { "x-forwarded-for": "10.0.0.99" },
    });
    expect(eleventh.statusCode).toBe(429);
  });

  it("TRUST_PROXY_HOPS=1: X-Forwarded-For is honored — two distinct client IPs get independent buckets", async () => {
    const { app } = await makeApp({ env: { ...testEnv, TRUST_PROXY_HOPS: 1 } });

    for (const clientIp of ["203.0.113.10", "203.0.113.20"]) {
      for (let i = 0; i < 10; i += 1) {
        const res = await app.inject({
          method: "POST",
          url: "/auth/otp/request",
          payload: { phoneHash: phoneHash(i + (clientIp === "203.0.113.10" ? 0 : 10)) },
          headers: { "x-forwarded-for": clientIp },
        });
        expect(res.statusCode).toBe(200);
      }
    }
  });
});

describe("POST /auth/otp/* — OTP_RATE_LIMIT config (issue #128, IDT-03)", () => {
  it("OTP_RATE_LIMITS resolves the strict/relaxed tiers to the required max/timeWindow", () => {
    expect(OTP_RATE_LIMITS.strict).toEqual({ max: 10, timeWindow: "1 minute" });
    expect(OTP_RATE_LIMITS.relaxed).toEqual({ max: 100, timeWindow: "20 minutes" });
  });

  it("OTP_RATE_LIMIT unset (default 'strict') still throttles at the 11th request regardless of NODE_ENV", async () => {
    const { app } = await makeApp({ env: { ...testEnv, NODE_ENV: "development" } });

    for (let i = 0; i < 10; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phoneHash: phoneHash(i) },
      });
      expect(res.statusCode).toBe(200);
    }

    const eleventh = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: phoneHash(10) },
    });
    expect(eleventh.statusCode).toBe(429);
  });

  it("OTP_RATE_LIMIT=relaxed lifts the ceiling past the strict 10/min cap (for local dev / E2E runs, issue #128)", async () => {
    const { app } = await makeApp({ env: { ...testEnv, OTP_RATE_LIMIT: "relaxed" } });

    // Well past the strict 10-request ceiling; still far under the relaxed 100.
    for (let i = 0; i < 15; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phoneHash: phoneHash(i) },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});

describe("POST /auth/otp/verify — displayName rejects control/bidi-override chars (SUG-API-015, IDT-01/IDT-09)", () => {
  it.each([
    ["a C0 control character", "A\u0000mina"],
    ["a bidi right-to-left override", "Amina‮"],
    ["an embedded newline", "a\nb"],
  ])("IDT-01/G1: displayName with %s is rejected 400 and no user is created", async (_label, displayName) => {
    const { app, repo } = await makeApp();
    const requested = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phoneHash: PHONE_HASH_A },
    });
    const { devCode } = requested.json<{ devCode: string }>();

    const verified = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phoneHash: PHONE_HASH_A, code: devCode, displayName },
    });

    expect(verified.statusCode).toBe(400);
    expect(verified.headers["content-type"]).toContain("application/problem+json");
    expect(JSON.stringify(verified.json())).not.toContain(displayName);
    expect(repo.users.size).toBe(0);
  });

  it.each([
    ["accented Latin", "Élodie"],
    ["Arabic script", "صواب"],
    ["a composite emoji (ZWJ sequence)", "Amina \u{1F469}‍\u{1F469}‍\u{1F467}"],
  ])("IDT-01: displayName with %s is accepted", async (_label, displayName) => {
    const { app, repo } = await makeApp();
    const tokens = await signup(app, phoneHash(900 + displayName.length), displayName);
    expect(tokens.isNewUser).toBe(true);
    expect(repo.users.size).toBe(1);
  });
});
