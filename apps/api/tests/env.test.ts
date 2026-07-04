import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("G1: fails fast, naming offending variables without leaking their values", () => {
    expect(() => loadEnv({})).toThrowError(/DATABASE_URL/);
    expect(() => loadEnv({})).toThrowError(/JWT_SECRET/);

    try {
      loadEnv({ DATABASE_URL: "postgresql://u:p@h:5432/db", JWT_SECRET: "hunter2-too-short" });
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("JWT_SECRET");
      expect(message).not.toContain("hunter2"); // secret value never in the error (G1/G3)
    }
  });

  it("G1: applies defaults for PORT and NODE_ENV", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      JWT_SECRET: "a".repeat(32),
    });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
  });

  it("G1: rejects a non-numeric PORT", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgresql://u:p@h:5432/db",
        JWT_SECRET: "a".repeat(32),
        PORT: "not-a-port",
      }),
    ).toThrowError(/PORT/);
  });
});
