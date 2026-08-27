/**
 * HTTP contract for the rôles·contexte endpoints (ADR-001 stage 3 slice 2,
 * part 2/2 — PR 2). The repository semantics (idempotency, tombstones,
 * IDT-08 scoping) are proven in `contact-roles-contract.ts`, which runs
 * against BOTH the in-memory double used here and real Postgres
 * (`contact-roles-repo.postgres.test.ts`). This file covers only what the
 * route layer itself can get wrong: auth, the Idempotency-Key header,
 * request-body validation, status codes, the response envelope, cross-user
 * isolation, and the G3 log audit — including the URL-based leak this route
 * shape was specifically designed to avoid (see `contact-roles.ts`'s header
 * comment).
 */
import { describe, expect, it } from "vitest";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { makeApp, PHONE_HASH_A, PHONE_HASH_B, signup, testEnv } from "./helpers.js";
import { buildApp } from "../src/app.js";
import { fakeRepository } from "./fake-repo.js";

const INVITED_HASH = `c${"0".repeat(63)}`;

function key(label: string): string {
  return `mut-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Session {
  app: FastifyInstance;
  token: string;
}

async function signedIn(): Promise<Session & { second(): Promise<Session> }> {
  const { app } = await makeApp();
  const a = await signup(app, PHONE_HASH_A, "Aïcha");
  return {
    app,
    token: a.accessToken,
    async second() {
      const b = await signup(app, PHONE_HASH_B, "Bilal");
      return { app, token: b.accessToken };
    },
  };
}

async function create(s: Session, body: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "POST",
    url: "/contacts",
    headers: { authorization: `Bearer ${s.token}`, "idempotency-key": key("c") },
    payload: body,
  });
}

async function seed(s: Session, body: Record<string, unknown> = {}): Promise<{ id: string }> {
  const res = await create(s, { invitedPhoneHash: INVITED_HASH, displayName: "Salma", ...body });
  expect(res.statusCode).toBe(201);
  return res.json<{ contact: { id: string } }>().contact;
}

async function addRole(
  s: Session,
  id: string,
  role: string,
  idempotencyKey: string | null = key("add"),
): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "POST",
    url: `/contacts/${id}/roles`,
    headers: {
      authorization: `Bearer ${s.token}`,
      ...(idempotencyKey === null ? {} : { "idempotency-key": idempotencyKey }),
    },
    payload: { role },
  });
}

async function removeRole(
  s: Session,
  id: string,
  role: string,
  idempotencyKey: string | null = key("rm"),
): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "POST",
    url: `/contacts/${id}/roles/remove`,
    headers: {
      authorization: `Bearer ${s.token}`,
      ...(idempotencyKey === null ? {} : { "idempotency-key": idempotencyKey }),
    },
    payload: { role },
  });
}

describe("contact role routes — auth and idempotency key (VLT-02, VLT-07)", () => {
  it("VLT02 both routes refuse an unauthenticated caller", async () => {
    const { app } = await makeApp();
    for (const c of [
      { method: "POST" as const, url: "/contacts/abc/roles" },
      { method: "POST" as const, url: "/contacts/abc/roles/remove" },
    ]) {
      // 401 before validation runs — an unauthenticated caller must not be
      // able to probe the request schema either.
      const res = await app.inject({ ...c, payload: { role: "family" } });
      expect(res.statusCode).toBe(401);
    }
  });

  it("VLT07 adding or removing a role without an Idempotency-Key is rejected", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    const addRes = await addRole(s, contact.id, "family", null);
    expect(addRes.statusCode).toBe(400);
    expect(addRes.json<{ title: string }>().title).toBe("Missing or invalid Idempotency-Key");

    const removeRes = await removeRole(s, contact.id, "family", null);
    expect(removeRes.statusCode).toBe(400);
  });
});

describe("POST /contacts/:id/roles (VLT-02, VLT-07)", () => {
  it("VLT02 adds a role and echoes it with the updated contact", async () => {
    const s = await signedIn();
    const contact = await seed(s);

    const res = await addRole(s, contact.id, "colleague");
    expect(res.statusCode).toBe(200);
    const body = res.json<{ outcome: string; role: string; contact: Record<string, unknown> }>();
    expect(body.outcome).toBe("applied");
    expect(body.role).toBe("colleague");
    expect(body.contact.id).toBe(contact.id);
  });

  it("VLT02 adding the same role twice is a no_op the second time", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    await addRole(s, contact.id, "family");

    const res = await addRole(s, contact.id, "family");
    expect(res.statusCode).toBe(200);
    expect(res.json<{ outcome: string }>().outcome).toBe("no_op");
  });

  it("VLT07 replaying the same mutation id returns already_applied with no contact body", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    const id = key("replay-add");

    const first = await addRole(s, contact.id, "partner", id);
    expect(first.statusCode).toBe(200);
    expect(first.json<{ outcome: string }>().outcome).toBe("applied");

    const replay = await addRole(s, contact.id, "partner", id);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ outcome: "already_applied", contact: null });
  });

  it("VLT02 an invalid role value is a 400 that never echoes the submitted value", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    const res = await addRole(s, contact.id, "best-friend-forever");
    expect(res.statusCode).toBe(400);
    expect(res.payload).not.toContain("best-friend-forever");
  });

  it("VLT07 an unknown contact is a 404 and does not burn the mutation id", async () => {
    const s = await signedIn();
    const id = key("unburnt");
    const missed = await addRole(s, "contact-that-never-existed", "family", id);
    expect(missed.statusCode).toBe(404);

    const contact = await seed(s);
    const retried = await addRole(s, contact.id, "family", id);
    expect(retried.statusCode).toBe(200);
    expect(retried.json<{ outcome: string }>().outcome).toBe("applied");
  });
});

describe("POST /contacts/:id/roles/remove (VLT-09)", () => {
  it("VLT09 removes a role and replays as already_applied", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    await addRole(s, contact.id, "neighbor");
    const id = key("del-role");

    const first = await removeRole(s, contact.id, "neighbor", id);
    expect(first.statusCode).toBe(200);
    expect(first.json<{ outcome: string }>().outcome).toBe("applied");

    const replay = await removeRole(s, contact.id, "neighbor", id);
    expect(replay.json()).toEqual({ outcome: "already_applied", contact: null });
  });

  it("VLT09 removing a role that was never added is a recorded no_op, not an error", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    const res = await removeRole(s, contact.id, "cohort");
    expect(res.statusCode).toBe(200);
    expect(res.json<{ outcome: string }>().outcome).toBe("no_op");
  });

  it("VLT02 an invalid role value on removal is also a 400", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    const res = await removeRole(s, contact.id, "not-a-role");
    expect(res.statusCode).toBe(400);
  });
});

describe("cross-user isolation (VLT-02, IDT-08)", () => {
  it("IDT08 user B gets an identical 404 whether the contact is missing or just not theirs", async () => {
    const a = await signedIn();
    const b = await a.second();
    const contact = await seed(a);

    const bAdd = await addRole(b, contact.id, "family");
    const bMissing = await addRole(b, "contact-that-never-existed", "family");
    // 404, never 403 — a 403 would confirm the id names a real row (IDT-08).
    // Same shape too (title/status), `requestId` aside — that's the one field
    // that legitimately differs per-request.
    expect(bAdd.statusCode).toBe(404);
    expect(bMissing.statusCode).toBe(404);
    const omitRequestId = (body: Record<string, unknown>): Record<string, unknown> => {
      const { requestId, ...rest } = body;
      void requestId;
      return rest;
    };
    expect(omitRequestId(bAdd.json())).toEqual(omitRequestId(bMissing.json()));

    const bRemove = await removeRole(b, contact.id, "family");
    expect(bRemove.statusCode).toBe(404);

    // A's contact was never touched by B's attempts.
    await addRole(a, contact.id, "family");
    const list = await a.app.inject({
      method: "GET",
      url: "/contacts",
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(list.json<{ contacts: unknown[] }>().contacts).toHaveLength(1);
  });
});

describe("log audit (VLT-03, G3)", () => {
  it("VLT03 the role value never reaches any log line, including Fastify's own request/url logging", async () => {
    const lines: string[] = [];
    const app = await buildApp({
      env: testEnv,
      repo: fakeRepository(),
      dbHealth: async () => ({ ok: true, latencyMs: 1 }),
      // `trace` so nothing is filtered out by level — the audit must see
      // everything the app is capable of emitting, including Fastify's own
      // default request-completion logging (not just explicit req.log calls).
      logger: { level: "trace", stream: { write: (chunk: string) => void lines.push(chunk) } },
    });
    const session: Session = {
      app,
      token: (await signup(app, PHONE_HASH_A, "Aïcha")).accessToken,
    };

    const contact = await seed(session, { displayName: "Zoubeïda-Kalthoum" });
    await addRole(session, contact.id, "family");
    await removeRole(session, contact.id, "family");

    const logged = lines.join("\n");
    expect(logged).not.toBe("");
    for (const secret of [
      "family", // the role value itself — classification data (VLT-03)
      "Zoubeïda-Kalthoum",
      INVITED_HASH,
      PHONE_HASH_A,
    ]) {
      expect(logged).not.toContain(secret);
    }
    // The ids and outcomes that make the logs useful ARE there.
    expect(logged).toContain(contact.id);
    expect(logged).toContain("contact role added");
    expect(logged).toContain("contact role removed");
  });
});
