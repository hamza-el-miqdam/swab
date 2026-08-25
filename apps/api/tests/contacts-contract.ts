/**
 * ONE behavioural contract for `ContactsRepository`, run against BOTH
 * implementations (ADR-001 stage 3):
 *
 *   - `contacts-repo.fake.test.ts`     → the in-memory double (no database)
 *   - `contacts-repo.postgres.test.ts` → Prisma against real Postgres (G2: no mocks)
 *
 * Why a shared suite rather than two: the route tests run against the double,
 * so if the double's idempotency / LWW / tombstone semantics drift from
 * Prisma's, every route test becomes a lie. Here they cannot drift silently.
 *
 * Determinism note: every LWW assertion below is built on a `null` → non-null
 * transition of a field timestamp, never on two timestamps being distinguishable
 * within the same millisecond. Clock granularity can therefore never make these
 * flaky.
 */
import { describe, expect, it } from "vitest";
import type { ContactsRepository } from "../src/repo.js";

export interface ContactsHarness {
  repo: ContactsRepository;
  /** Persists a fresh user and returns its id. */
  createUser(): Promise<string>;
}

let mutationSeq = 0;
/** Client-generated ids (VLT-07) — shaped like what a real outbox emits. */
export function mutationId(label = "m"): string {
  mutationSeq += 1;
  return `${label}-${mutationSeq}-${Date.now().toString(36)}`;
}

export function runContactsRepositoryContract(
  label: string,
  makeHarness: () => Promise<ContactsHarness>,
): void {
  describe(`ContactsRepository contract (${label})`, () => {
    async function setup(): Promise<{ repo: ContactsRepository; owner: string }> {
      const harness = await makeHarness();
      return { repo: harness.repo, owner: await harness.createUser() };
    }

    /** A pending-invite link: no target user needed, so it works in every harness. */
    async function seedContact(
      repo: ContactsRepository,
      owner: string,
      overrides: { ring?: number; displayName?: string } = {},
    ) {
      const result = await repo.createContact(owner, mutationId("seed"), {
        invitedPhoneHash: `hash-${mutationId("h")}`,
        displayName: overrides.displayName ?? "Contact",
        ...(overrides.ring !== undefined ? { ring: overrides.ring } : {}),
      });
      if (result.outcome !== "created") throw new Error(`seed failed: ${result.outcome}`);
      return result.contact;
    }

    it("VLT02 create then delta pull returns the owner's contact", async () => {
      const { repo, owner } = await setup();
      const created = await seedContact(repo, owner, { displayName: "Salma", ring: 2 });

      const page = await repo.listContactsSince(owner, null, 50);
      expect(page.contacts.map((c) => c.id)).toEqual([created.id]);
      expect(page.contacts[0]?.ring).toBe(2);
      expect(page.contacts[0]?.fieldUpdatedAt.ring).toBeInstanceOf(Date);
      expect(page.hasMore).toBe(false);
    });

    it("VLT02 IDT08 another user's pull never sees it, and cannot patch or delete it", async () => {
      const harness = await makeHarness();
      const owner = await harness.createUser();
      const other = await harness.createUser();
      const created = await seedContact(harness.repo, owner);

      const otherPage = await harness.repo.listContactsSince(other, null, 50);
      expect(otherPage.contacts).toEqual([]);

      // 404-shaped, not 403-shaped: "not yours" and "does not exist" must be
      // indistinguishable, or the id itself becomes an oracle (IDT-08).
      const patched = await harness.repo.patchContact(other, mutationId(), created.id, {
        ring: { value: 4, baseUpdatedAt: null },
      });
      expect(patched.outcome).toBe("not_found");
      const deleted = await harness.repo.deleteContact(other, mutationId(), created.id);
      expect(deleted.outcome).toBe("not_found");

      // ...and the owner's row is untouched by the attempt.
      const ownerPage = await harness.repo.listContactsSince(owner, null, 50);
      expect(ownerPage.contacts[0]?.deletedAt).toBeNull();
      expect(ownerPage.contacts[0]?.ring).toBeNull();
    });

    it("VLT07 replaying a create with the same mutation id applies exactly once", async () => {
      const { repo, owner } = await setup();
      const id = mutationId("replay");
      const input = { invitedPhoneHash: `hash-${id}`, displayName: "Karim" };

      const first = await repo.createContact(owner, id, input);
      const replay = await repo.createContact(owner, id, input);

      expect(first.outcome).toBe("created");
      expect(replay.outcome).toBe("already_applied");
      // The ledger deliberately caches no response body — the client re-pulls.
      expect(replay).not.toHaveProperty("contact");
      const page = await repo.listContactsSince(owner, null, 50);
      expect(page.contacts).toHaveLength(1);
    });

    it("VLT07 replaying a patch with the same mutation id applies exactly once", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);
      const id = mutationId("replay-patch");
      const write = { ring: { value: 3, baseUpdatedAt: null } } as const;

      const first = await repo.patchContact(owner, id, contact.id, write);
      const replay = await repo.patchContact(owner, id, contact.id, write);

      expect(first.outcome).toBe("applied");
      expect(replay.outcome).toBe("already_applied");
      const page = await repo.listContactsSince(owner, null, 50);
      expect(page.contacts[0]?.ring).toBe(3);
      // Not re-stamped by the replay: the second call did nothing at all.
      expect(page.contacts[0]?.fieldUpdatedAt.ring).toEqual(
        first.outcome === "applied" ? first.contact.fieldUpdatedAt.ring : null,
      );
    });

    it("VLT07 a mutation id is scoped per user, so two users may pick the same one", async () => {
      const harness = await makeHarness();
      const a = await harness.createUser();
      const b = await harness.createUser();
      const shared = mutationId("collide");

      const first = await harness.repo.createContact(a, shared, {
        invitedPhoneHash: `hash-a-${shared}`,
      });
      const second = await harness.repo.createContact(b, shared, {
        invitedPhoneHash: `hash-b-${shared}`,
      });

      expect(first.outcome).toBe("created");
      expect(second.outcome).toBe("created");
    });

    it("VLT07 a not_found mutation does not burn the client's mutation id", async () => {
      const { repo, owner } = await setup();
      const id = mutationId("unburnt");
      const missed = await repo.patchContact(owner, id, "contact-that-never-existed", {
        ring: { value: 1, baseUpdatedAt: null },
      });
      expect(missed.outcome).toBe("not_found");

      const contact = await seedContact(repo, owner);
      const retried = await repo.patchContact(owner, id, contact.id, {
        ring: { value: 1, baseUpdatedAt: null },
      });
      expect(retried.outcome).toBe("applied");
    });

    it("VLT08 the server assigns updatedAt and moves it forward on every applied write", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);

      const patched = await repo.patchContact(owner, mutationId(), contact.id, {
        etat: { value: "paused", baseUpdatedAt: null },
      });
      if (patched.outcome !== "applied") throw new Error(patched.outcome);
      expect(patched.contact.updatedAt.getTime()).toBeGreaterThanOrEqual(
        contact.updatedAt.getTime(),
      );
      expect(patched.contact.fieldUpdatedAt.etat).toEqual(patched.contact.updatedAt);
      // FCH-05: an axis change resets the staleness timer; a rename would not.
      expect(patched.contact.lastAxisChangeAt).toEqual(patched.contact.updatedAt);
    });

    it("VLT08 a cursor pull returns only what changed since it was issued", async () => {
      const { repo, owner } = await setup();
      const first = await seedContact(repo, owner, { displayName: "First" });
      await new Promise((resolve) => setTimeout(resolve, 2));
      const second = await seedContact(repo, owner, { displayName: "Second" });

      const page1 = await repo.listContactsSince(owner, null, 50);
      expect(page1.contacts.map((c) => c.id)).toEqual([first.id, second.id]);

      // The cursor's own millisecond is re-scanned by design (cursor.ts): the
      // boundary row may come back, anything strictly older never does.
      const page2 = await repo.listContactsSince(owner, page1.nextCursor, 50);
      expect(page2.contacts.map((c) => c.id)).not.toContain(first.id);
      expect(page2.hasMore).toBe(false);

      await repo.patchContact(owner, mutationId(), first.id, {
        ressenti: { value: "positive", baseUpdatedAt: null },
      });
      const page3 = await repo.listContactsSince(owner, page1.nextCursor, 50);
      expect(page3.contacts.map((c) => c.id)).toContain(first.id);
    });

    it("VLT08 a record updated inside the cursor's own millisecond is still delivered", async () => {
      // Regression: a strict `updatedAt > since` keyset drops this row forever,
      // because the write lands in the very millisecond the cursor names.
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);
      const page1 = await repo.listContactsSince(owner, null, 50);

      await repo.patchContact(owner, mutationId(), contact.id, {
        etat: { value: "busy", baseUpdatedAt: null },
      });

      const page2 = await repo.listContactsSince(owner, page1.nextCursor, 50);
      expect(page2.contacts.map((c) => c.id)).toEqual([contact.id]);
      expect(page2.contacts[0]?.etat).toBe("busy");
    });

    it("VLT08 paging never skips rows that share a millisecond, and always terminates", async () => {
      const { repo, owner } = await setup();
      // Created back-to-back on purpose: several rows land in the same
      // millisecond, which a bare `updatedAt > since` cursor would drop.
      const expected = new Set<string>();
      for (let i = 0; i < 5; i += 1) expected.add((await seedContact(repo, owner)).id);

      const seen = new Set<string>();
      let pages = 0;
      let cursor = null as Awaited<ReturnType<typeof repo.listContactsSince>>["nextCursor"];
      for (; pages < 10; pages += 1) {
        const result = await repo.listContactsSince(owner, cursor, 2);
        for (const c of result.contacts) seen.add(c.id);
        cursor = result.nextCursor;
        if (!result.hasMore) break;
      }
      // A boundary row may be re-delivered by design (cursor.ts); a skipped one
      // is data loss. Only the second is a bug, so only the second is asserted —
      // together with termination, which the id-bearing cursor guarantees.
      expect(seen).toEqual(expected);
      expect(pages).toBeLessThan(9);
    });

    it("VLT08 paging terminates when a page boundary falls between two milliseconds", async () => {
      // Regression: an inclusive cursor emitted mid-pull restarts the next page
      // at the row just delivered, so `limit`-sized pages never advanced.
      const { repo, owner } = await setup();
      const expected = new Set<string>();
      for (let i = 0; i < 3; i += 1) {
        expected.add((await seedContact(repo, owner)).id);
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      const seen = new Set<string>();
      let pages = 0;
      let cursor = null as Awaited<ReturnType<typeof repo.listContactsSince>>["nextCursor"];
      for (; pages < 8; pages += 1) {
        const result = await repo.listContactsSince(owner, cursor, 1);
        for (const c of result.contacts) seen.add(c.id);
        cursor = result.nextCursor;
        if (!result.hasMore) break;
      }
      expect(seen).toEqual(expected);
      expect(pages).toBeLessThan(7);
    });

    it("VLT09 two devices editing different fields of one contact both win", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);

      // Both devices' caches say "no server value yet" for the field they touch.
      const deviceA = await repo.patchContact(owner, mutationId("A"), contact.id, {
        ring: { value: 1, baseUpdatedAt: null },
      });
      const deviceB = await repo.patchContact(owner, mutationId("B"), contact.id, {
        ressenti: { value: "ambivalent", baseUpdatedAt: null },
      });

      expect(deviceA.outcome).toBe("applied");
      expect(deviceB.outcome).toBe("applied");
      const page = await repo.listContactsSince(owner, null, 50);
      expect(page.contacts[0]?.ring).toBe(1); // field-level, not record-level
      expect(page.contacts[0]?.ressenti).toBe("ambivalent");
    });

    it("VLT09 a write whose base timestamp is stale loses to the stored value", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);

      await repo.patchContact(owner, mutationId("fresh"), contact.id, {
        ring: { value: 2, baseUpdatedAt: null },
      });
      // The offline device still believes the field has never been set.
      const stale = await repo.patchContact(owner, mutationId("stale"), contact.id, {
        ring: { value: 4, baseUpdatedAt: null },
      });

      expect(stale.outcome).toBe("no_op");
      if (stale.outcome !== "no_op") throw new Error("unreachable");
      expect(stale.staleFields).toEqual(["ring"]);
      expect(stale.contact.ring).toBe(2);
    });

    it("VLT09 within one mutation a stale field is dropped while a fresh one applies", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);
      await repo.patchContact(owner, mutationId(), contact.id, {
        ring: { value: 2, baseUpdatedAt: null },
      });

      const mixed = await repo.patchContact(owner, mutationId(), contact.id, {
        ring: { value: 4, baseUpdatedAt: null }, // stale
        etat: { value: "away", baseUpdatedAt: null }, // fresh
      });

      expect(mixed.outcome).toBe("applied");
      if (mixed.outcome === "already_applied" || mixed.outcome === "not_found") throw new Error();
      expect(mixed.staleFields).toEqual(["ring"]);
      expect(mixed.contact.ring).toBe(2);
      expect(mixed.contact.etat).toBe("away");
    });

    it("VLT09 clearing a field is a real write, not a no-op", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner, { ring: 3 });

      const cleared = await repo.patchContact(owner, mutationId(), contact.id, {
        ring: { value: null, baseUpdatedAt: contact.fieldUpdatedAt.ring },
      });

      expect(cleared.outcome).toBe("applied");
      if (cleared.outcome !== "applied") throw new Error("unreachable");
      expect(cleared.contact.ring).toBeNull();
      // The timestamp still moves, so the next stale write still loses.
      expect(cleared.contact.fieldUpdatedAt.ring).not.toBeNull();
    });

    it("VLT09 a stale pre-deletion update does not resurrect a tombstoned contact", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner, { ring: 1 });
      const baseBeforeDelete = contact.fieldUpdatedAt.ring;

      const deleted = await repo.deleteContact(owner, mutationId(), contact.id);
      expect(deleted.outcome).toBe("applied");

      const zombie = await repo.patchContact(owner, mutationId(), contact.id, {
        ring: { value: 4, baseUpdatedAt: baseBeforeDelete },
      });

      expect(zombie.outcome).toBe("no_op");
      if (zombie.outcome !== "no_op") throw new Error("unreachable");
      expect(zombie.contact.deletedAt).not.toBeNull();
      expect(zombie.contact.ring).toBe(1);
    });

    it("VLT08 VLT09 the delta pull carries tombstones so a cached device converges", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);
      const page1 = await repo.listContactsSince(owner, null, 50);

      await repo.deleteContact(owner, mutationId(), contact.id);

      const page2 = await repo.listContactsSince(owner, page1.nextCursor, 50);
      expect(page2.contacts.map((c) => c.id)).toEqual([contact.id]);
      expect(page2.contacts[0]?.deletedAt).not.toBeNull();
    });

    it("VLT07 deleting an already tombstoned contact is a recorded no_op", async () => {
      const { repo, owner } = await setup();
      const contact = await seedContact(repo, owner);
      await repo.deleteContact(owner, mutationId(), contact.id);

      const again = await repo.deleteContact(owner, mutationId(), contact.id);
      expect(again.outcome).toBe("no_op");
    });

    it("VLT02 a second LIVE link to the same invited hash is rejected, but re-adding after a delete works", async () => {
      const { repo, owner } = await setup();
      const hash = `hash-dup-${mutationId()}`;
      const first = await repo.createContact(owner, mutationId(), { invitedPhoneHash: hash });
      if (first.outcome !== "created") throw new Error(first.outcome);

      const dup = await repo.createContact(owner, mutationId(), { invitedPhoneHash: hash });
      expect(dup.outcome).toBe("duplicate");

      await repo.deleteContact(owner, mutationId(), first.contact.id);
      const readded = await repo.createContact(owner, mutationId(), { invitedPhoneHash: hash });
      expect(readded.outcome).toBe("created");
    });

    it("VLT02 a create naming an unknown target user is rejected without creating a row", async () => {
      const { repo, owner } = await setup();
      const result = await repo.createContact(owner, mutationId(), {
        targetId: "user-that-does-not-exist",
      });
      expect(result.outcome).toBe("unknown_target");
      const page = await repo.listContactsSince(owner, null, 50);
      expect(page.contacts).toEqual([]);
    });

    it("VLT02 a create naming a real target user links the two", async () => {
      const harness = await makeHarness();
      const owner = await harness.createUser();
      const target = await harness.createUser();

      const result = await harness.repo.createContact(owner, mutationId(), {
        targetId: target,
        displayName: "Nadia",
      });

      expect(result.outcome).toBe("created");
      if (result.outcome !== "created") throw new Error("unreachable");
      expect(result.contact.targetId).toBe(target);
      // IDT-08: the link is directional — the target sees nothing.
      const targetPage = await harness.repo.listContactsSince(target, null, 50);
      expect(targetPage.contacts).toEqual([]);
    });
  });
}
