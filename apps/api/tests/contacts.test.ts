/**
 * HTTP contract for the typed classification endpoints (ADR-001 stage 3).
 *
 * The repository semantics themselves (idempotency, field-level LWW,
 * tombstones) are proven in `contacts-contract.ts`, which runs against BOTH the
 * in-memory double used here and real Postgres. This file covers what only the
 * route layer can get wrong: authentication, validation, status codes, the
 * response envelope, cross-user isolation, and the G3 log audit.
 */
import { describe, expect, it } from "vitest";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { makeApp, PHONE_HASH_A, PHONE_HASH_B, signup, testEnv } from "./helpers.js";
import { buildApp } from "../src/app.js";
import { fakeRepository } from "./fake-repo.js";

const INVITED_HASH = `c${"0".repeat(63)}`;
const OTHER_HASH = `d${"1".repeat(63)}`;

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

async function post(
  s: Session,
  body: Record<string, unknown>,
  idempotencyKey: string | null = key("c"),
): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "POST",
    url: "/contacts",
    headers: {
      authorization: `Bearer ${s.token}`,
      ...(idempotencyKey === null ? {} : { "idempotency-key": idempotencyKey }),
    },
    payload: body,
  });
}

async function patch(
  s: Session,
  id: string,
  body: Record<string, unknown>,
  idempotencyKey = key("p"),
): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "PATCH",
    url: `/contacts/${id}`,
    headers: { authorization: `Bearer ${s.token}`, "idempotency-key": idempotencyKey },
    payload: body,
  });
}

async function remove(
  s: Session,
  id: string,
  idempotencyKey = key("d"),
): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "DELETE",
    url: `/contacts/${id}`,
    headers: { authorization: `Bearer ${s.token}`, "idempotency-key": idempotencyKey },
  });
}

async function list(s: Session, query = ""): Promise<LightMyRequestResponse> {
  return await s.app.inject({
    method: "GET",
    url: `/contacts${query}`,
    headers: { authorization: `Bearer ${s.token}` },
  });
}

async function seed(s: Session, body: Record<string, unknown> = {}) {
  const res = await post(s, { invitedPhoneHash: INVITED_HASH, displayName: "Salma", ...body });
  expect(res.statusCode).toBe(201);
  return res.json<{ contact: Record<string, never> }>().contact as Record<string, never> & {
    id: string;
    fieldUpdatedAt: Record<string, string | null>;
  };
}

describe("contacts routes — auth and idempotency key (VLT-02, VLT-07)", () => {
  it("VLT02 every route refuses an unauthenticated caller", async () => {
    const { app } = await makeApp();
    const cases = [
      { method: "GET" as const, url: "/contacts", payload: {} },
      { method: "POST" as const, url: "/contacts", payload: {} },
      { method: "PATCH" as const, url: "/contacts/abc", payload: {} },
      { method: "DELETE" as const, url: "/contacts/abc", payload: {} },
    ];
    for (const c of cases) {
      const res = await app.inject(c);
      // 401 before validation runs: an unauthenticated caller must not be able
      // to probe the request schema either.
      expect(res.statusCode).toBe(401);
    }
  });

  it("VLT07 a write without an Idempotency-Key is rejected and nothing is created", async () => {
    const s = await signedIn();
    const res = await post(s, { invitedPhoneHash: INVITED_HASH }, null);
    expect(res.statusCode).toBe(400);
    expect(res.json<{ title: string }>().title).toBe("Missing or invalid Idempotency-Key");
    expect((await list(s)).json<{ contacts: unknown[] }>().contacts).toEqual([]);
  });

  it("VLT07 an Idempotency-Key that is too short or malformed is rejected", async () => {
    const s = await signedIn();
    for (const bad of ["short", "has spaces here", "a".repeat(65)]) {
      expect((await post(s, { invitedPhoneHash: INVITED_HASH }, bad)).statusCode).toBe(400);
    }
  });
});

describe("POST /contacts (VLT-02, VLT-07)", () => {
  it("VLT02 creates a pending-invite contact with 201 and a Location header", async () => {
    const s = await signedIn();
    const res = await post(s, {
      invitedPhoneHash: INVITED_HASH,
      displayName: "Salma",
      ring: 2,
      etat: "paused",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ outcome: string; contact: Record<string, unknown> }>();
    expect(body.outcome).toBe("applied");
    expect(res.headers.location).toBe(`/contacts/${body.contact.id as string}`);
    expect(body.contact).toMatchObject({
      deleted: false,
      ring: 2,
      etat: "paused",
      ressenti: null,
      // VLT-05 (issue #153): always present, never null/undefined, even with
      // no roles yet.
      roles: [],
    });
    // Server-assigned, and handed back so the client can use them as LWW bases.
    expect((body.contact.fieldUpdatedAt as Record<string, string>).ring).toEqual(
      expect.any(String),
    );
    expect((body.contact.fieldUpdatedAt as Record<string, string | null>).ressenti).toBeNull();
  });

  it("VLT07 replaying the create returns already_applied with no contact body", async () => {
    const s = await signedIn();
    const id = key("replay");
    expect((await post(s, { invitedPhoneHash: INVITED_HASH }, id)).statusCode).toBe(201);

    const replay = await post(s, { invitedPhoneHash: INVITED_HASH }, id);
    expect(replay.statusCode).toBe(200);
    // No cached response body by design (VLT-03) — the client re-pulls by cursor.
    expect(replay.json()).toEqual({ outcome: "already_applied", contact: null });
    expect((await list(s)).json<{ contacts: unknown[] }>().contacts).toHaveLength(1);
  });

  it("VLT02 a second live contact for the same person is a 409, not a duplicate row", async () => {
    const s = await signedIn();
    await seed(s);
    const dup = await post(s, { invitedPhoneHash: INVITED_HASH });
    expect(dup.statusCode).toBe(409);
    expect(dup.headers["content-type"]).toContain("application/problem+json");
  });

  it("VLT02 rejects an unknown target, a self-link, and a body naming neither or both", async () => {
    const s = await signedIn();
    const me = await signup(s.app, PHONE_HASH_A, "Aïcha");

    expect((await post(s, { targetId: "user-does-not-exist" })).statusCode).toBe(422);
    expect((await post(s, { targetId: me.userId })).statusCode).toBe(422);
    expect((await post(s, {})).statusCode).toBe(400);
    expect(
      (await post(s, { targetId: me.userId, invitedPhoneHash: INVITED_HASH })).statusCode,
    ).toBe(400);
    expect((await list(s)).json<{ contacts: unknown[] }>().contacts).toEqual([]);
  });

  it("VLT03 a rejected classification value never appears in the error payload", async () => {
    const s = await signedIn();
    const res = await post(s, {
      invitedPhoneHash: INVITED_HASH,
      etat: "vaguement-fâché",
      // Distinctive enough that it cannot collide with the hex requestId in the
      // problem body — an assertion on a short number would be flaky, not safe.
      ring: 987654321,
    });
    expect(res.statusCode).toBe(400);
    expect(res.payload).not.toContain("vaguement-fâché");
    expect(res.payload).not.toContain("987654321");
  });
});

describe("PATCH /contacts/:id (VLT-08, VLT-09)", () => {
  it("VLT08 VLT09 applies a field write and reports a stale one instead of silently dropping it", async () => {
    const s = await signedIn();
    const contact = await seed(s);

    const first = await patch(s, contact.id, { ring: { value: 3, baseUpdatedAt: null } });
    expect(first.statusCode).toBe(200);
    expect(first.json<{ outcome: string }>().outcome).toBe("applied");

    // A device that never saw the write above replays its own edit.
    const stale = await patch(s, contact.id, {
      ring: { value: 1, baseUpdatedAt: null },
      ressenti: { value: "negative", baseUpdatedAt: null },
    });
    const body = stale.json<{
      outcome: string;
      staleFields: string[];
      contact: Record<string, unknown>;
    }>();
    expect(body.outcome).toBe("applied");
    expect(body.staleFields).toEqual(["ring"]);
    expect(body.contact.ring).toBe(3); // stored value won
    expect(body.contact.ressenti).toBe("negative"); // field-level, not record-level
  });

  it("VLT09 a base timestamp round-tripped from a previous response wins", async () => {
    const s = await signedIn();
    const contact = await seed(s, { ring: 1 });

    const res = await patch(s, contact.id, {
      ring: { value: 4, baseUpdatedAt: contact.fieldUpdatedAt.ring },
    });
    const body = res.json<{ outcome: string; staleFields?: string[]; contact: { ring: number } }>();
    expect(body.outcome).toBe("applied");
    expect(body.staleFields).toBeUndefined();
    expect(body.contact.ring).toBe(4);
  });

  it("VLT09 patching a tombstoned contact is a no_op that returns only the tombstone", async () => {
    const s = await signedIn();
    const contact = await seed(s, { ring: 1 });
    await remove(s, contact.id);

    const res = await patch(s, contact.id, {
      ring: { value: 4, baseUpdatedAt: contact.fieldUpdatedAt.ring },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ outcome: string; contact: Record<string, unknown> }>();
    expect(body.outcome).toBe("no_op");
    expect(body.contact).toEqual({
      id: contact.id,
      deleted: true,
      updatedAt: expect.any(String),
      deletedAt: expect.any(String),
    });
    // A tombstone carries no classification at all.
    expect(res.payload).not.toContain("Salma");
  });

  it("VLT07 an empty patch body and an unknown contact are rejected", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    expect((await patch(s, contact.id, {})).statusCode).toBe(400);
    expect(
      (await patch(s, "nope", { ring: { value: 1, baseUpdatedAt: null } })).statusCode,
    ).toBe(404);
  });
});

describe("DELETE /contacts/:id (VLT-09)", () => {
  it("VLT09 tombstones the contact and replays as already_applied", async () => {
    const s = await signedIn();
    const contact = await seed(s);
    const id = key("del");

    const first = await remove(s, contact.id, id);
    expect(first.statusCode).toBe(200);
    expect(first.json<{ contact: { deleted: boolean } }>().contact.deleted).toBe(true);

    const replay = await remove(s, contact.id, id);
    expect(replay.json()).toEqual({ outcome: "already_applied", contact: null });
  });
});

describe("GET /contacts — delta pull (VLT-08)", () => {
  it("VLT08 pages with an opaque cursor until every record has been delivered", async () => {
    const s = await signedIn();
    const first = await seed(s);
    const second = await post(s, { invitedPhoneHash: OTHER_HASH, displayName: "Karim" });
    const secondId = second.json<{ contact: { id: string } }>().contact.id;

    const page1 = await list(s, "?limit=1");
    const body1 = page1.json<{ contacts: { id: string }[]; nextCursor: string; hasMore: boolean }>();
    expect(body1.contacts).toHaveLength(1);
    expect(body1.hasMore).toBe(true);
    expect(body1.nextCursor).toEqual(expect.any(String));

    // Drive the loop the way a client does. The boundary millisecond may be
    // re-scanned (cursor.ts), so this asserts the guarantee that matters —
    // nothing is ever skipped — not an exact per-page partition.
    const seen = new Set(body1.contacts.map((c) => c.id));
    let cursor = body1.nextCursor;
    for (let page = 0; page < 5; page += 1) {
      const res = await list(s, `?limit=1&since=${encodeURIComponent(cursor)}`);
      const body = res.json<{ contacts: { id: string }[]; nextCursor: string; hasMore: boolean }>();
      for (const c of body.contacts) seen.add(c.id);
      cursor = body.nextCursor;
      if (!body.hasMore) break;
    }
    expect(seen).toEqual(new Set([first.id, secondId]));
  });

  it("VLT08 a malformed cursor is a 400, never a silent full re-sync", async () => {
    const s = await signedIn();
    await seed(s);
    const res = await list(s, "?since=not-a-real-cursor");
    expect(res.statusCode).toBe(400);
    expect(res.json<{ title: string }>().title).toBe("Invalid cursor");
  });

  it("VLT08 rejects an out-of-range limit", async () => {
    const s = await signedIn();
    expect((await list(s, "?limit=0")).statusCode).toBe(400);
    expect((await list(s, "?limit=5000")).statusCode).toBe(400);
  });
});

describe("cross-user isolation (VLT-02, IDT-08)", () => {
  it("IDT08 user B gets nothing of user A's on any route", async () => {
    const a = await signedIn();
    const b = await a.second();
    const contact = await seed(a, { ring: 4, ressenti: "negative", displayName: "Zoubeïda" });

    const bList = await list(b);
    expect(bList.json<{ contacts: unknown[] }>().contacts).toEqual([]);
    expect(bList.payload).not.toContain("Zoubeïda");
    expect(bList.payload).not.toContain(INVITED_HASH);

    // 404, never 403 — a 403 would confirm the id names a real row.
    const bPatch = await patch(b, contact.id, { ring: { value: 1, baseUpdatedAt: null } });
    expect(bPatch.statusCode).toBe(404);
    const bDelete = await remove(b, contact.id);
    expect(bDelete.statusCode).toBe(404);

    // ...and A's row survived both attempts untouched.
    const aList = await list(a);
    expect(aList.json<{ contacts: { ring: number; deleted: boolean }[] }>().contacts[0]).toMatchObject(
      { ring: 4, deleted: false },
    );
  });

  it("IDT08 a target user never learns they were linked", async () => {
    const a = await signedIn();
    const b = await a.second();
    const bUser = await signup(a.app, PHONE_HASH_B, "Bilal");

    expect((await post(a, { targetId: bUser.userId, displayName: "Bilal" })).statusCode).toBe(201);
    expect((await list(b)).json<{ contacts: unknown[] }>().contacts).toEqual([]);
  });
});

describe("log audit (VLT-03, G3)", () => {
  it("VLT03 no classification value reaches any log line across a full lifecycle", async () => {
    const lines: string[] = [];
    const app = await buildApp({
      env: testEnv,
      repo: fakeRepository(),
      dbHealth: async () => ({ ok: true, latencyMs: 1 }),
      // `trace` so nothing is filtered out by level — the audit must see
      // everything the app is capable of emitting.
      logger: { level: "trace", stream: { write: (chunk: string) => void lines.push(chunk) } },
    });
    const session: Session = {
      app,
      token: (await signup(app, PHONE_HASH_A, "Aïcha")).accessToken,
    };

    const contact = await seed(session, {
      displayName: "Zoubeïda-Kalthoum",
      ring: 4,
      etat: "paused",
      ressenti: "negative",
    });
    await patch(session, contact.id, { ressenti: { value: "ambivalent", baseUpdatedAt: null } });
    await remove(session, contact.id);
    await list(session);

    const logged = lines.join("\n");
    expect(logged).not.toBe("");
    for (const secret of [
      "Zoubeïda-Kalthoum", // the owner's private label for this person
      "paused",
      "negative",
      "ambivalent",
      INVITED_HASH, // phone hash (G3)
      PHONE_HASH_A,
    ]) {
      expect(logged).not.toContain(secret);
    }
    // The ids and counts that make the logs useful ARE there.
    expect(logged).toContain(contact.id);
    expect(logged).toContain("contact patched");
  });
});
