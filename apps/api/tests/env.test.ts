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

  it("G1: OTP_DEV_CODE=enabled in production fails boot", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgresql://u:p@h:5432/db",
        JWT_SECRET: "a".repeat(32),
        NODE_ENV: "production",
        OTP_DEV_CODE: "enabled",
      }),
    ).toThrowError(/OTP_DEV_CODE/);
  });

  it("G1: OTP_DEV_CODE defaults to disabled", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      JWT_SECRET: "a".repeat(32),
    });
    expect(env.OTP_DEV_CODE).toBe("disabled");
  });

  it("IDT-03: TRUST_PROXY_HOPS defaults to 0 (directly exposed, no forwarded headers trusted)", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      JWT_SECRET: "a".repeat(32),
    });
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it("IDT-03: rejects a negative or non-integer TRUST_PROXY_HOPS", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgresql://u:p@h:5432/db",
        JWT_SECRET: "a".repeat(32),
        TRUST_PROXY_HOPS: "-1",
      }),
    ).toThrowError(/TRUST_PROXY_HOPS/);
  });

  it("IDT-03: OTP_RATE_LIMIT defaults to strict", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      JWT_SECRET: "a".repeat(32),
    });
    expect(env.OTP_RATE_LIMIT).toBe("strict");
  });

  it("IDT-03: OTP_RATE_LIMIT=relaxed in production fails boot (fail-closed, mirrors OTP_DEV_CODE)", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgresql://u:p@h:5432/db",
        JWT_SECRET: "a".repeat(32),
        NODE_ENV: "production",
        OTP_RATE_LIMIT: "relaxed",
      }),
    ).toThrowError(/OTP_RATE_LIMIT/);
  });

  it("IDT-03: OTP_RATE_LIMIT=relaxed is accepted outside production", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      JWT_SECRET: "a".repeat(32),
      NODE_ENV: "development",
      OTP_RATE_LIMIT: "relaxed",
    });
    expect(env.OTP_RATE_LIMIT).toBe("relaxed");
  });
});
