/**
 * SUG-DB-010 — the destructive wipe guard in prisma/seed.ts is a pure,
 * DB-less function (`canWipe`) so it's testable without PGlite/Postgres.
 * No network, no fixtures: just the host/env decision table from the
 * suggestion's acceptance criteria.
 *
 * Remote-host fixtures deliberately use a vendor-neutral `*.example.com`
 * hostname: `canWipe` allowlists local/compose hosts and has no
 * provider-specific branch, so the vendor is incidental to what these cases
 * assert — and a real managed-Postgres hostname here would trip the G4
 * portability lint (`scripts/portability-lint.mjs`).
 */
import { EnvieStatus, MatchState, Platform, ProposalState } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

  it("refuses a remote managed host without SEED_ALLOW_WIPE", () => {
    expect(
      canWipe("postgresql://u:p@ep-cool-name-123.eu-west-3.managed-pg.example.com/swab", {}),
    ).toBe(false);
  });

  it("allows a remote managed host when SEED_ALLOW_WIPE=1", () => {
    expect(
      canWipe("postgresql://u:p@ep-cool-name-123.eu-west-3.managed-pg.example.com/swab", {
        SEED_ALLOW_WIPE: "1",
      }),
    ).toBe(true);
  });

  it("refuses an unparseable DATABASE_URL", () => {
    expect(canWipe("", {})).toBe(false);
    expect(canWipe("not-a-url", {})).toBe(false);
  });
});

/**
 * SUG-DB-014 — data-steward rule 4 requires the seed to cover every enum
 * state. `prisma/seed.ts`'s `main()` needs a real DATABASE_URL (it talks to
 * Postgres via PrismaClient, not PGlite), so it can't run inside this
 * package's DB-less vitest suite. Every fixture below spells its enum member
 * as the qualified literal (`EnvieStatus.WITHDRAWN`, `Platform.WEB`, ...), so
 * a source scan for that literal is a cheap, DB-less proxy for "the seeded
 * DB contains a row with this value" — it fails the instant a member stops
 * being referenced, the exact drift rule 4 exists to catch.
 */
describe("SUG-DB-014 seed enum-state coverage", () => {
  const seedSource = readFileSync(
    fileURLToPath(new URL("../prisma/seed.ts", import.meta.url)),
    "utf8",
  );

  function expectEveryMemberReferenced(enumName: string, members: Record<string, string>): void {
    for (const member of Object.keys(members)) {
      expect(seedSource).toContain(`${enumName}.${member}`);
    }
  }

  it("references every EnvieStatus member", () => {
    expectEveryMemberReferenced("EnvieStatus", EnvieStatus);
  });

  it("references every MatchState member", () => {
    expectEveryMemberReferenced("MatchState", MatchState);
  });

  it("references every ProposalState member", () => {
    expectEveryMemberReferenced("ProposalState", ProposalState);
  });

  it("references every Platform member", () => {
    expectEveryMemberReferenced("Platform", Platform);
  });
});
