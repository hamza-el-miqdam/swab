/**
 * Unit tests for the error branching in `prisma-contacts-repo.ts` (VLT-07).
 * Prisma is STUBBED here, not mocked-in-integration: the real transactional,
 * LWW and tombstone semantics stay real-Postgres-only in
 * `contacts-repo.postgres.test.ts` (backend rule 7, G2).
 *
 * What only a stub can reach: `runMutation`'s disambiguation of a P2002. The
 * ledger insert and the data write share a transaction, so a unique violation
 * can come from either — and the two mean opposite things ("your replay lost a
 * race" vs "this contact already exists"). Provoking that race against a real
 * database means two interleaved connections; here it is three lines. These are
 * also the branches whose failure mode is worst: a misclassified P2002 either
 * silently drops a write or reports a phantom conflict.
 */
import { Prisma } from "@repo/db";
import { describe, expect, it, vi } from "vitest";
import { prismaContactsRepository } from "../src/prisma-contacts-repo.js";

const uniqueViolation = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const foreignKeyViolation = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
  });

/**
 * `ledgerRows` is consulted by `clientMutation.findUnique`; `onCreate` decides
 * what the contact insert does. `$transaction` just runs the callback — the stub
 * cannot model rollback, which is precisely why the real semantics live in the
 * Postgres suite.
 */
function stubClient(options: {
  ledgerHitsAfterFailure?: boolean;
  onCreate: () => unknown;
}) {
  let ledgerReads = 0;
  const client = {
    clientMutation: {
      findUnique: vi.fn(() => {
        ledgerReads += 1;
        // First read is the fast path (must miss, or no write is attempted);
        // the second is the post-failure disambiguation.
        const hit = ledgerReads > 1 && options.ledgerHitsAfterFailure === true;
        return Promise.resolve(hit ? { id: "m" } : null);
      }),
      create: vi.fn(() => Promise.resolve({})),
    },
    contactLink: { create: vi.fn(options.onCreate) },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(client)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, not a real PrismaClient
  } as any;
  return client;
}

describe("prismaContactsRepository().createContact — P2002 disambiguation (VLT-07)", () => {
  it("VLT07 reports a duplicate contact when the ledger row is absent after the failure", async () => {
    const repo = prismaContactsRepository(
      stubClient({ onCreate: () => Promise.reject(uniqueViolation()) }),
    );
    const result = await repo.createContact("user-1", "mutation-0001", {
      invitedPhoneHash: "hash",
    });
    expect(result.outcome).toBe("duplicate");
  });

  it("VLT07 reports already_applied when a concurrent replay committed the ledger row first", async () => {
    const repo = prismaContactsRepository(
      stubClient({
        ledgerHitsAfterFailure: true,
        onCreate: () => Promise.reject(uniqueViolation()),
      }),
    );
    // Same P2002 as above; only the surviving ledger row distinguishes them. Get
    // this wrong and a lost replay race is reported to the client as a 409.
    const result = await repo.createContact("user-1", "mutation-0002", {
      invitedPhoneHash: "hash",
    });
    expect(result.outcome).toBe("already_applied");
  });

  it("VLT02 maps a foreign-key violation to an unknown target rather than a conflict", async () => {
    const repo = prismaContactsRepository(
      stubClient({ onCreate: () => Promise.reject(foreignKeyViolation()) }),
    );
    const result = await repo.createContact("user-1", "mutation-0003", { targetId: "ghost" });
    expect(result.outcome).toBe("unknown_target");
  });

  it("VLT07 rethrows an infrastructure failure instead of swallowing it into a 409", async () => {
    const repo = prismaContactsRepository(
      stubClient({ onCreate: () => Promise.reject(new Error("connection refused")) }),
    );
    // A dropped connection reported as "duplicate" would make a client retry
    // forever against a transient outage.
    await expect(
      repo.createContact("user-1", "mutation-0004", { invitedPhoneHash: "hash" }),
    ).rejects.toThrow("connection refused");
  });

  it("VLT07 answers a known mutation id from the fast path without attempting a write", async () => {
    const client = stubClient({ onCreate: () => Promise.resolve({}) });
    client.clientMutation.findUnique = vi.fn(() => Promise.resolve({ id: "m" }));
    const repo = prismaContactsRepository(client);

    const result = await repo.createContact("user-1", "mutation-0005", {
      invitedPhoneHash: "hash",
    });

    expect(result).toEqual({ outcome: "already_applied" });
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.contactLink.create).not.toHaveBeenCalled();
  });
});

/**
 * A minimal `ContactLink` row for `toRecord()` — every field it reads, no
 * more. Reused across the `addRole` race tests below.
 */
function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-1",
    ownerId: "user-1",
    targetId: null,
    invitedPhoneHash: "hash",
    displayName: null,
    ring: null,
    etat: null,
    ressenti: null,
    displayNameUpdatedAt: null,
    ringUpdatedAt: null,
    etatUpdatedAt: null,
    ressentiUpdatedAt: null,
    lastAxisChangeAt: null,
    stalenessSnoozedUntil: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * `contactRole.create` rejects by default — that is the race this stub
 * exists to model: two concurrent "add this same role" mutations (different
 * mutationIds — two devices from the offline outbox) both pass the
 * check-first read before either commits, and the loser hits the composite
 * PK (`@@id([contactLinkId, role])`). `$transaction` just runs the callback —
 * it cannot model a real rollback, which is exactly why the true race can
 * only be provoked against real Postgres (deferred to the PR 2 Postgres
 * suite); this stub exists solely to pin `addRole`'s P2002-handling branch.
 */
function stubAddRoleClient(options: { createThrows?: () => unknown } = {}) {
  const row = contactRow();
  const client = {
    clientMutation: {
      // Never a replay in this scenario: both the fast-path check and
      // `runMutation`'s post-failure disambiguation read miss, which is what
      // routes the P2002 out to `addRole`'s own catch in the first place.
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
    },
    contactLink: {
      findFirst: vi.fn(() => Promise.resolve(row)),
      findFirstOrThrow: vi.fn(() => Promise.resolve(row)),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
    contactRole: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(options.createThrows ?? (() => Promise.reject(uniqueViolation()))),
      update: vi.fn(() => Promise.resolve({})),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(client)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, not a real PrismaClient
  } as any;
  return client;
}

describe("prismaContactsRepository().addRole — concurrent-add race (VLT-07)", () => {
  it("VLT07 resolves a composite-PK P2002 from a concurrent add to no_op instead of leaking the raw Prisma error", async () => {
    const client = stubAddRoleClient();
    const repo = prismaContactsRepository(client);

    const result = await repo.addRole("user-1", "mutation-0001", "contact-1", "colleague");

    expect(result).toMatchObject({ outcome: "no_op", role: "colleague" });
    if (result.outcome === "no_op") expect(result.contact.id).toBe("contact-1");
    // The re-read that builds the no_op response must go through the client
    // directly, not anything captured inside the rolled-back transaction.
    expect(client.contactLink.findFirst).toHaveBeenCalledWith({
      where: { id: "contact-1", ownerId: "user-1" },
    });
  });

  it("VLT07 still rethrows an infrastructure failure rather than treating it as a role race", async () => {
    const client = stubAddRoleClient({
      createThrows: () => Promise.reject(new Error("connection refused")),
    });
    const repo = prismaContactsRepository(client);

    await expect(
      repo.addRole("user-1", "mutation-0002", "contact-1", "colleague"),
    ).rejects.toThrow("connection refused");
  });
});
