/**
 * The `ContactRolesRepository` contract, run against the in-memory double.
 *
 * This is the half that runs everywhere with no database — and it is the half
 * every route test (PR 2) implicitly depends on, which is exactly why it is
 * held to the same suite as Prisma (`contact-roles-repo.postgres.test.ts`).
 */
import { randomUUID } from "node:crypto";
import { runContactRolesRepositoryContract } from "./contact-roles-contract.js";
import { fakeRepository } from "./fake-repo.js";

runContactRolesRepositoryContract("in-memory double", async () => {
  const repo = fakeRepository();
  return {
    repo,
    async createUser() {
      const user = await repo.createUser(`fake-${randomUUID()}`, "fake-user");
      return user.id;
    },
  };
});
