import { describe, expect, it } from "vitest";
import { makeApp, PHONE_HASH_A, PHONE_HASH_B, signup, testEnv, type TokenPair } from "./helpers.js";

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
