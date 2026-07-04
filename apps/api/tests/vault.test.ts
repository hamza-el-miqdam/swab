import { describe, expect, it } from "vitest";
import { signJwt } from "../src/lib/jwt.js";
import { makeApp, PHONE_HASH_A, signup, testEnv } from "./helpers.js";

/** Deliberately non-UTF8, non-JSON bytes — the server must not care. */
const OPAQUE_BYTES = Buffer.from([0x00, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47, 0x7b, 0x22, 0x01]);

describe("GET /vault + POST /vault", () => {
  it("VLT-02: vault roundtrip — write then read returns the identical blob with bumped version", async () => {
    const { app } = await makeApp();
    const { accessToken } = await signup(app, PHONE_HASH_A, "Amina");
    const auth = { authorization: `Bearer ${accessToken}` };

    const written = await app.inject({
      method: "POST",
      url: "/vault",
      headers: auth,
      payload: { blob: OPAQUE_BYTES.toString("base64"), version: 0 },
    });
    expect(written.statusCode).toBe(200);
    expect(written.json<{ version: number }>().version).toBe(1);

    const read = await app.inject({ method: "GET", url: "/vault", headers: auth });
    expect(read.statusCode).toBe(200);
    const body = read.json<{ blob: string; version: number; updatedAt: string }>();
    expect(Buffer.from(body.blob, "base64").equals(OPAQUE_BYTES)).toBe(true);
    expect(body.version).toBe(1);
    expect(new Date(body.updatedAt).getTime()).not.toBeNaN();
  });

  it("VLT-02: stale-version write is rejected 409 with the currentVersion", async () => {
    const { app } = await makeApp();
    const { accessToken } = await signup(app, PHONE_HASH_A, "Amina");
    const auth = { authorization: `Bearer ${accessToken}` };
    const blob = OPAQUE_BYTES.toString("base64");

    const v1 = await app.inject({ method: "POST", url: "/vault", headers: auth, payload: { blob, version: 0 } });
    expect(v1.json<{ version: number }>().version).toBe(1);
    const v2 = await app.inject({ method: "POST", url: "/vault", headers: auth, payload: { blob, version: 1 } });
    expect(v2.json<{ version: number }>().version).toBe(2);

    // Client writes again from the stale base version 1 → conflict.
    const stale = await app.inject({ method: "POST", url: "/vault", headers: auth, payload: { blob, version: 1 } });
    expect(stale.statusCode).toBe(409);
    expect(stale.headers["content-type"]).toContain("application/problem+json");
    expect(stale.json<{ currentVersion: number }>().currentVersion).toBe(2);
  });

  it("VLT-03: the blob is opaque — stored verbatim, never parsed or interpreted by the server", async () => {
    const { app, repo } = await makeApp();
    const { accessToken, userId } = await signup(app, PHONE_HASH_A, "Amina");
    const auth = { authorization: `Bearer ${accessToken}` };

    const written = await app.inject({
      method: "POST",
      url: "/vault",
      headers: auth,
      payload: { blob: OPAQUE_BYTES.toString("base64"), version: 0 },
    });
    expect(written.statusCode).toBe(200);

    // Bit-identical bytes reached storage: the only transformation was base64
    // transport decoding — no JSON parse, no inspection, no mutation.
    const stored = repo.vaults.get(userId);
    expect(stored).toBeDefined();
    expect(stored?.blob.equals(OPAQUE_BYTES)).toBe(true);
  });

  it("VLT-03: a blob over the 1 MB quota is rejected 413 (byte length is the only inspection)", async () => {
    const { app } = await makeApp();
    const { accessToken } = await signup(app, PHONE_HASH_A, "Amina");

    const tooBig = Buffer.alloc(1_048_577, 7).toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/vault",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { blob: tooBig, version: 0 },
    });
    expect(res.statusCode).toBe(413);
    expect(res.headers["content-type"]).toContain("application/problem+json");
  });

  it("IDT-02: vault endpoints require a valid access token — missing, garbage, refresh-typed, and expired tokens are all 401", async () => {
    const { app } = await makeApp();
    const { refreshToken, userId } = await signup(app, PHONE_HASH_A, "Amina");

    const missing = await app.inject({ method: "GET", url: "/vault" });
    expect(missing.statusCode).toBe(401);

    const garbage = await app.inject({
      method: "GET",
      url: "/vault",
      headers: { authorization: "Bearer not.a.jwt" },
    });
    expect(garbage.statusCode).toBe(401);

    // A refresh token must not open vault access.
    const refreshAsAccess = await app.inject({
      method: "GET",
      url: "/vault",
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(refreshAsAccess.statusCode).toBe(401);

    const expired = signJwt({ sub: userId, type: "access" }, testEnv.JWT_SECRET, -1);
    const expiredRes = await app.inject({
      method: "GET",
      url: "/vault",
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(expiredRes.statusCode).toBe(401);
  });

  it("VLT-02: GET before the first sync returns a 404 problem", async () => {
    const { app } = await makeApp();
    const { accessToken } = await signup(app, PHONE_HASH_A, "Amina");
    const res = await app.inject({
      method: "GET",
      url: "/vault",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
  });
});
