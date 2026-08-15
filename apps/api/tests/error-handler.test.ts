import { describe, expect, it } from "vitest";
import { makeApp } from "./helpers.js";

// SUG-API-016: the global error handler (app.ts setErrorHandler) must not pass
// arbitrary thrown-error messages through as RFC 7807 `title` verbatim — only
// an allowlisted set of known Fastify content-type-parser codes get a fixed,
// safe title; everything else collapses to a generic "Request Error".
describe("global error handler — 4xx title allowlist (G1/G3)", () => {
  it("G1: an unsupported content-type is rejected without echoing the header value", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      headers: { "content-type": "application/x-evil-reflected" },
      payload: "irrelevant",
    });
    expect(res.statusCode).toBe(415);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).not.toContain("x-evil-reflected");
  });

  it("G1: malformed JSON body → 400 problem with a generic title", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      headers: { "content-type": "application/json" },
      payload: "{nope",
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    // Not Fastify's raw SyntaxError-shaped message — that's an internal detail.
    expect(res.json<{ title: string }>().title).toBe("Request Error");
  });

  it("G3: an oversized body → 413 problem with a fixed title", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      headers: { "content-type": "application/json" },
      // bodyLimit (app.ts) is 2 MB.
      payload: JSON.stringify({ phoneHash: "a".repeat(3 * 1024 * 1024) }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json<{ title: string }>().title).toBe("Payload Too Large");
  });
});
