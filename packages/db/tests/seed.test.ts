/**
 * SUG-DB-010 — the destructive wipe guard in prisma/seed.ts is a pure,
 * DB-less function (`canWipe`) so it's testable without PGlite/Postgres.
 * No network, no fixtures: just the host/env decision table from the
 * suggestion's acceptance criteria.
 */
import { describe, expect, it } from "vitest";

import { canWipe } from "../prisma/seed.js";

describe("SUG-DB-010 canWipe", () => {
  it("refuses in production regardless of host", () => {
    expect(
      canWipe("postgresql://u:p@localhost:5432/swab", { NODE_ENV: "production" }),
    ).toBe(false);
    expect(
      canWipe("postgresql://u:p@localhost:5432/swab", {
        NODE_ENV: "production",
        SEED_ALLOW_WIPE: "1",
      }),
    ).toBe(false);
  });

  it("allows localhost without any opt-in", () => {
    expect(canWipe("postgresql://swab:pw@localhost:5432/swab", {})).toBe(true);
  });

  it("allows 127.0.0.1 without any opt-in", () => {
    expect(canWipe("postgresql://swab:pw@127.0.0.1:5432/swab", {})).toBe(true);
  });

  it("allows the docker-compose service host 'db' without any opt-in", () => {
    expect(canWipe("postgresql://swab:swab_local_dev@db:5432/swab", {})).toBe(true);
  });

  it("refuses a Neon-shaped host without SEED_ALLOW_WIPE", () => {
    expect(
      canWipe("postgresql://u:p@ep-cool-name-123.us-east-2.aws.neon.tech/swab", {}),
    ).toBe(false);
  });

  it("allows a Neon-shaped host when SEED_ALLOW_WIPE=1", () => {
    expect(
      canWipe("postgresql://u:p@ep-cool-name-123.us-east-2.aws.neon.tech/swab", {
        SEED_ALLOW_WIPE: "1",
      }),
    ).toBe(true);
  });

  it("refuses an unparseable DATABASE_URL", () => {
    expect(canWipe("", {})).toBe(false);
    expect(canWipe("not-a-url", {})).toBe(false);
  });
});
