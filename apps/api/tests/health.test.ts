import { describe, expect, it } from "vitest";
import { makeApp } from "./helpers.js";

describe("GET /health + GET /ready", () => {
  it("G3: /health returns 200 with no dependencies", async () => {
    const { app } = await makeApp({
      // Even a dead DB must not affect liveness.
      dbHealth: async () => {
        throw new Error("db is down");
      },
    });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe("ok");
  });

  it("G3: /ready returns 200 with DB latency when dbHealth is ok", async () => {
    const { app } = await makeApp({ dbHealth: async () => ({ ok: true, latencyMs: 4 }) });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string; db: { latencyMs: number } }>().db.latencyMs).toBe(4);
  });

  it("G3: /ready returns a 503 problem when the database is unreachable", async () => {
    const { app } = await makeApp({ dbHealth: async () => ({ ok: false, latencyMs: 0 }) });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    expect(res.headers["content-type"]).toContain("application/problem+json");
  });

  it("G3: /ready returns a 503 problem when the health check throws", async () => {
    const { app } = await makeApp({
      dbHealth: async () => {
        throw new Error("connection refused");
      },
    });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
  });

  it("G3: unknown routes return an RFC 7807 problem with a requestId", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json<{ requestId: string }>().requestId).toBeTruthy();
  });

  it("G1/G3: a well-formed x-request-id is honored (namespaced) and echoed", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/nope",
      headers: { "x-request-id": "e2e-abc_1.2" },
    });
    // Honored for correlation, but never verbatim — see the forgery test below.
    expect(res.json<{ requestId: string }>().requestId).toBe("client-e2e-abc_1.2");
    expect(res.headers["x-request-id"]).toBe("client-e2e-abc_1.2");
  });

  it("G1/G3: a client cannot forge a server-shaped request id (log-forgery guard)", async () => {
    const { app } = await makeApp();
    // randomUUID() output itself satisfies the ID-shape regex, so without
    // namespacing a caller could replay a victim's id (harvested from the
    // echoed header) and interleave its log lines under that victim's trace.
    const victimId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await app.inject({
      method: "GET",
      url: "/nope",
      headers: { "x-request-id": victimId },
    });
    const forged = res.json<{ requestId: string }>().requestId;
    expect(forged).not.toBe(victimId);
    expect(forged).not.toMatch(/^[0-9a-f-]{36}$/); // never mistakable for a server UUID
    expect(forged).toBe(`client-${victimId}`);
  });

  it("G1: an over-long or malformed x-request-id is replaced with a generated UUID", async () => {
    const { app } = await makeApp();

    const overLong = await app.inject({
      method: "GET",
      url: "/nope",
      headers: { "x-request-id": "a".repeat(300) },
    });
    const overLongId = overLong.json<{ requestId: string }>().requestId;
    expect(overLongId).toMatch(/^[0-9a-f-]{36}$/);

    const malformed = await app.inject({
      method: "GET",
      url: "/nope",
      headers: { "x-request-id": "bad id!\n" },
    });
    const malformedId = malformed.json<{ requestId: string }>().requestId;
    expect(malformedId).toMatch(/^[0-9a-f-]{36}$/);
    expect(malformedId).not.toContain("bad id!");
  });

  it("G3: success responses carry x-request-id", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});
