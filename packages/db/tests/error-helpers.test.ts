/**
 * Unit tests for the typed error helpers (SUG-DB-011). Pure functions over
 * `unknown` — constructed `PrismaClientKnownRequestError` instances, no
 * PGlite/Postgres needed. These exist so consumers (apps/api's
 * prisma-repo.ts) never need to `instanceof Prisma.PrismaClientKnownRequestError`
 * by hand and never conflate a P2002 with an unrelated failure (VLT-02).
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isForeignKeyViolation, isUniqueViolation } from "../src/index.js";

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("simulated Prisma error", {
    code,
    clientVersion: "test",
  });
}

describe("isUniqueViolation", () => {
  it("is true for a P2002 unique-constraint violation", () => {
    expect(isUniqueViolation(knownRequestError("P2002"))).toBe(true);
  });

  it("is false for a different known-request error code", () => {
    expect(isUniqueViolation(knownRequestError("P2003"))).toBe(false);
  });

  it("is false for a connection/timeout-style plain Error", () => {
    expect(isUniqueViolation(new Error("connection refused"))).toBe(false);
  });

  it("is false for non-error values", () => {
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  it("is true for a P2003 foreign-key violation", () => {
    expect(isForeignKeyViolation(knownRequestError("P2003"))).toBe(true);
  });

  it("is false for a different known-request error code", () => {
    expect(isForeignKeyViolation(knownRequestError("P2002"))).toBe(false);
  });

  it("is false for a plain Error", () => {
    expect(isForeignKeyViolation(new Error("dropped connection"))).toBe(false);
  });

  it("is false for non-error values", () => {
    expect(isForeignKeyViolation(undefined)).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });
});
