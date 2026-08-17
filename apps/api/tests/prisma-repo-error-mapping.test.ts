/**
 * Unit tests for prisma-repo.ts's error mapping in upsertVault (SUG-API-003,
 * VLT-02) and createUser (SUG-API-004, IDT-01). Prisma is stubbed here, not
 * mocked-in-integration: these tests exercise only the catch/rethrow
 * branching around a unique-violation, never the real compare-and-swap or
 * create semantics (those stay real-Postgres-only, no mocking, in
 * tests/prisma-repo.test.ts per backend rule 7 / SUG-API-006).
 */
import { Prisma } from "@repo/db";
import { describe, expect, it, vi } from "vitest";
import { prismaRepository } from "../src/prisma-repo.js";

function fakePrismaClient(overrides: {
  create: (...args: unknown[]) => unknown;
  findUnique: (...args: unknown[]) => unknown;
}) {
  return {
    vault: {
      create: vi.fn(overrides.create),
      findUnique: vi.fn(overrides.findUnique),
      updateMany: vi.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, not a real PrismaClient
  } as any;
}

function fakeUserPrismaClient(overrides: {
  create: (...args: unknown[]) => unknown;
  findUnique: (...args: unknown[]) => unknown;
}) {
  return {
    user: {
      create: vi.fn(overrides.create),
      findUnique: vi.fn(overrides.findUnique),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, not a real PrismaClient
  } as any;
}

describe("prismaRepository().upsertVault — first-write error mapping (VLT-02)", () => {
  it("rethrows non-unique-violation errors instead of reporting a 409 conflict", async () => {
    const client = fakePrismaClient({
      create: () => Promise.reject(new Error("connection refused")),
      findUnique: () => Promise.reject(new Error("should not be called")),
    });
    const repo = prismaRepository(client);

    await expect(repo.upsertVault("user-1", Buffer.from("blob"), 0)).rejects.toThrow(
      "connection refused",
    );
  });

  it("maps a P2002 unique-violation on first write to a version conflict", async () => {
    const client = fakePrismaClient({
      create: () =>
        Promise.reject(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          }),
        ),
      findUnique: () => Promise.resolve({ version: 3 }),
    });
    const repo = prismaRepository(client);

    await expect(repo.upsertVault("user-1", Buffer.from("blob"), 0)).resolves.toEqual({
      ok: false,
      currentVersion: 3,
    });
  });

  it("rethrows when the P2002 row vanished before the follow-up read (row disappeared)", async () => {
    const client = fakePrismaClient({
      create: () =>
        Promise.reject(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          }),
        ),
      findUnique: () => Promise.resolve(null),
    });
    const repo = prismaRepository(client);

    await expect(repo.upsertVault("user-1", Buffer.from("blob"), 0)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });
});

describe("prismaRepository().createUser — concurrent-signup error mapping (IDT-01)", () => {
  it("rethrows non-unique-violation errors instead of reporting a false existing user", async () => {
    const client = fakeUserPrismaClient({
      create: () => Promise.reject(new Error("connection refused")),
      findUnique: () => Promise.reject(new Error("should not be called")),
    });
    const repo = prismaRepository(client);

    await expect(repo.createUser("phone-hash-1", "Amina")).rejects.toThrow("connection refused");
  });

  it("maps a P2002 unique-violation to the existing user (race loser signs in)", async () => {
    const existing = { id: "user-1", phoneHash: "phone-hash-1", displayName: "Amina" };
    const client = fakeUserPrismaClient({
      create: () =>
        Promise.reject(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          }),
        ),
      findUnique: () => Promise.resolve(existing),
    });
    const repo = prismaRepository(client);

    await expect(repo.createUser("phone-hash-1", "Amina")).resolves.toEqual(existing);
  });

  it("rethrows when the P2002 row vanished before the follow-up read (row disappeared)", async () => {
    const client = fakeUserPrismaClient({
      create: () =>
        Promise.reject(
          new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          }),
        ),
      findUnique: () => Promise.resolve(null),
    });
    const repo = prismaRepository(client);

    await expect(repo.createUser("phone-hash-1", "Amina")).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });
});
