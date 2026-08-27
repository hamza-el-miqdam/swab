/**
 * ONE behavioural contract for `ContactRolesRepository`, run against BOTH
 * implementations (ADR-001 stage 3 slice 2), mirroring `contacts-contract.ts`:
 *
 *   - `contact-roles-repo.fake.test.ts`     → the in-memory double (no database)
 *   - `contact-roles-repo.postgres.test.ts` → Prisma against real Postgres (G2: no mocks) [PR 2]
 *
 * Why a shared suite rather than two: the route tests (PR 2) run against the
 * double, so if the double's idempotency / tombstone semantics drift from
 * Prisma's, every route test becomes a lie. Here they cannot drift silently.
 */
import { describe, expect, it } from "vitest";
import type { ContactRolesRepository, ContactsRepository } from "../src/repo.js";

export interface ContactRolesHarness {
  repo: ContactsRepository & ContactRolesRepository;
  /** Persists a fresh user and returns its id. */
  createUser(): Promise<string>;
}

let mutationSeq = 0;
/** Client-generated ids (VLT-07) — shaped like what a real outbox emits. */
export function mutationId(label = "m"): string {
  mutationSeq += 1;
  return `${label}-${mutationSeq}-${Date.now().toString(36)}`;
}

export function runContactRolesRepositoryContract(
  label: string,
  makeHarness: () => Promise<ContactRolesHarness>,
): void {
  describe(`ContactRolesRepository contract (${label})`, () => {
    async function setup(): Promise<{
      repo: ContactsRepository & ContactRolesRepository;
      owner: string;
      contactId: string;
    }> {
      const harness = await makeHarness();
      const owner = await harness.createUser();
      const created = await harness.repo.createContact(owner, mutationId("seed"), {
        invitedPhoneHash: `hash-${mutationId("h")}`,
        displayName: "Contact",
      });
      if (created.outcome !== "created") throw new Error(`seed failed: ${created.outcome}`);
      return { repo: harness.repo, owner, contactId: created.contact.id };
    }

    it("VLT02 adding a role, then adding it again, is a no-op", async () => {
      const { repo, owner, contactId } = await setup();

      const first = await repo.addRole(owner, mutationId(), contactId, "colleague");
      const second = await repo.addRole(owner, mutationId(), contactId, "colleague");

      expect(first.outcome).toBe("applied");
      expect(second.outcome).toBe("no_op");
    });

    it("VLT09 removing a role tombstones it rather than hard-deleting", async () => {
      const { repo, owner, contactId } = await setup();
      await repo.addRole(owner, mutationId(), contactId, "family");

      const removed = await repo.removeRole(owner, mutationId(), contactId, "family");
      expect(removed.outcome).toBe("applied");

      // Removing an already-removed role is a recorded no_op, not an error —
      // mirrors deleteContact's own tombstone-of-a-tombstone shape.
      const again = await repo.removeRole(owner, mutationId(), contactId, "family");
      expect(again.outcome).toBe("no_op");
    });

    it("VLT02 a role removed then re-added works (tombstone is not a dead end)", async () => {
      const { repo, owner, contactId } = await setup();
      await repo.addRole(owner, mutationId(), contactId, "neighbor");
      await repo.removeRole(owner, mutationId(), contactId, "neighbor");

      const readded = await repo.addRole(owner, mutationId(), contactId, "neighbor");
      expect(readded.outcome).toBe("applied");
    });

    it("VLT02 IDT08 another user cannot add or remove a role on someone else's contact", async () => {
      const harness = await makeHarness();
      const owner = await harness.createUser();
      const other = await harness.createUser();
      const created = await harness.repo.createContact(owner, mutationId("seed"), {
        invitedPhoneHash: `hash-${mutationId("h")}`,
        displayName: "Contact",
      });
      if (created.outcome !== "created") throw new Error(`seed failed: ${created.outcome}`);
      const contactId = created.contact.id;

      // 404-shaped, not 403-shaped: "not yours" and "does not exist" must be
      // indistinguishable, or the id itself becomes an oracle (IDT-08).
      const added = await harness.repo.addRole(other, mutationId(), contactId, "partner");
      expect(added.outcome).toBe("not_found");

      await harness.repo.addRole(owner, mutationId(), contactId, "partner");
      const removed = await harness.repo.removeRole(other, mutationId(), contactId, "partner");
      expect(removed.outcome).toBe("not_found");
    });

    it("VLT07 replaying an add-role mutation id returns already_applied exactly once", async () => {
      const { repo, owner, contactId } = await setup();
      const id = mutationId("replay-add");

      const first = await repo.addRole(owner, id, contactId, "cohort");
      const replay = await repo.addRole(owner, id, contactId, "cohort");

      expect(first.outcome).toBe("applied");
      expect(replay.outcome).toBe("already_applied");
    });

    it("VLT07 replaying a remove-role mutation id returns already_applied exactly once", async () => {
      const { repo, owner, contactId } = await setup();
      await repo.addRole(owner, mutationId(), contactId, "community");
      const id = mutationId("replay-remove");

      const first = await repo.removeRole(owner, id, contactId, "community");
      const replay = await repo.removeRole(owner, id, contactId, "community");

      expect(first.outcome).toBe("applied");
      expect(replay.outcome).toBe("already_applied");
    });

    it("VLT08 adding a role bumps the parent contact's updatedAt", async () => {
      const { repo, owner, contactId } = await setup();
      const before = await repo.listContactsSince(owner, null, 50);
      const beforeUpdatedAt = before.contacts[0]?.updatedAt;
      expect(beforeUpdatedAt).toBeInstanceOf(Date);

      await new Promise((resolve) => setTimeout(resolve, 2));
      const result = await repo.addRole(owner, mutationId(), contactId, "family");
      expect(result.outcome).toBe("applied");
      if (result.outcome !== "applied") throw new Error("unreachable");

      expect(result.contact.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt!.getTime());
    });

    it("VLT08 removing a role also bumps the parent contact's updatedAt", async () => {
      const { repo, owner, contactId } = await setup();
      await repo.addRole(owner, mutationId(), contactId, "family");
      const before = await repo.listContactsSince(owner, null, 50);
      const beforeUpdatedAt = before.contacts[0]?.updatedAt;
      expect(beforeUpdatedAt).toBeInstanceOf(Date);

      await new Promise((resolve) => setTimeout(resolve, 2));
      const result = await repo.removeRole(owner, mutationId(), contactId, "family");
      expect(result.outcome).toBe("applied");
      if (result.outcome !== "applied") throw new Error("unreachable");

      expect(result.contact.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt!.getTime());
    });

    it("VLT07 a not_found role mutation does not burn the client's mutation id", async () => {
      const { repo, owner } = await setup();
      const id = mutationId("unburnt-role");
      const missed = await repo.addRole(owner, id, "contact-that-never-existed", "family");
      expect(missed.outcome).toBe("not_found");

      const created = await repo.createContact(owner, mutationId("seed2"), {
        invitedPhoneHash: `hash-${mutationId("h2")}`,
      });
      if (created.outcome !== "created") throw new Error("seed failed");
      const retried = await repo.addRole(owner, id, created.contact.id, "family");
      expect(retried.outcome).toBe("applied");
    });
  });
}
