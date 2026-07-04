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
});
