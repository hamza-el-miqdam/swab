import type { FastifyInstance } from "fastify";
import { buildApp, type AppDeps } from "../src/app.js";
import type { Env } from "../src/env.js";
import { fakeRepository, type FakeRepository } from "./fake-repo.js";

export const testEnv: Env = {
  DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/test",
  JWT_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  PORT: 3001,
  NODE_ENV: "test",
};

// Synthetic phoneHashes shaped like real client-side hashes — never E.164.
export const PHONE_HASH_A = "a".repeat(64);
export const PHONE_HASH_B = "b".repeat(64);

export interface TestApp {
  app: FastifyInstance;
  repo: FakeRepository;
}

export async function makeApp(overrides: Partial<AppDeps> = {}): Promise<TestApp> {
  const repo = fakeRepository();
  const app = await buildApp({
    env: testEnv,
    repo,
    dbHealth: async () => ({ ok: true, latencyMs: 1 }),
    logger: false,
    ...overrides,
  });
  return { app, repo };
}

export interface TokenPair {
  userId: string;
  isNewUser: boolean;
  accessToken: string;
  refreshToken: string;
}

/** Full OTP signup: request a code (devCode, test env only) then verify it. */
export async function signup(
  app: FastifyInstance,
  phoneHash: string,
  displayName: string,
): Promise<TokenPair> {
  const requested = await app.inject({
    method: "POST",
    url: "/auth/otp/request",
    payload: { phoneHash },
  });
  const { devCode } = requested.json<{ devCode: string }>();
  const verified = await app.inject({
    method: "POST",
    url: "/auth/otp/verify",
    payload: { phoneHash, code: devCode, displayName },
  });
  return verified.json<TokenPair>();
}
