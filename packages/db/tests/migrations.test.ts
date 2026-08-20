/**
 * Migration tests — every committed migration applied in order to a real
 * Postgres, then the invariants Prisma's schema language cannot express are
 * probed behaviourally.
 *
 * Runs against **PGlite** (Postgres compiled to WASM), not Docker and not a
 * Neon branch. That is the whole reason `packages/db` can have tests at all:
 * the DB-level testing gap (SUG-DB-004) was never a missing test plan, it was
 * the assumption that a DB test needs infrastructure. It needs a devDependency.
 *
 * What this does NOT cover: Prisma client behaviour against these tables, and
 * anything needing a Neon-specific feature (there is none — vanilla Postgres
 * only is a hard requirement). Route-level integration stays in apps/api.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const migrationsDir = join(fileURLToPath(new URL(".", import.meta.url)), "../prisma/migrations");

/** Applied in filename order — the same order `prisma migrate deploy` uses. */
function migrationDirs(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  for (const dir of migrationDirs()) {
    await db.exec(readFileSync(join(migrationsDir, dir, "migration.sql"), "utf8"));
  }
  await db.exec(
    `insert into users (id, phone_hash, display_name) values ('u1','h1','A'),('u2','h2','B')`,
  );
}, 60_000);

/**
 * Fresh link per test. `target_id` stays null: these cases are about column
 * constraints, and a real target would need a matching users row for the FK.
 * Carries a unique `invited_phone_hash` (a distinct one per call) so the row
 * satisfies `contact_links_resolved_or_pending` (SUG-DB-009) without needing
 * a target — these tests aren't exercising the pending-invite invariants.
 */
let seq = 0;
async function newLink(): Promise<string> {
  const id = `link-${++seq}`;
  await db.query(
    `insert into contact_links (id, owner_id, invited_phone_hash, updated_at) values ($1, 'u1', $2, now())`,
    [id, `hash-newlink-${seq}`],
  );
  return id;
}

describe("migrations apply", () => {
  it("every committed migration applies in order to an empty database", () => {
    // beforeAll would have thrown otherwise; this asserts we actually ran some.
    expect(migrationDirs().length).toBeGreaterThanOrEqual(3);
  });
});

describe("ADR-001 classification columns", () => {
  it("stores the FCH-09 identifiers verbatim, so a byte on device is the byte in Postgres", async () => {
    const enums = await db.query<{ typname: string; values: string }>(
      `select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) as values
         from pg_type t join pg_enum e on e.enumtypid = t.oid
        where t.typname in ('etat','ressenti','role_contexte')
        group by t.typname order by t.typname`,
    );
    expect(Object.fromEntries(enums.rows.map((r) => [r.typname, r.values]))).toEqual({
      etat: "available,busy,away,paused",
      ressenti: "positive,ambivalent,negative",
      role_contexte: "family,partner,colleague,cohort,community,neighbor",
    });
  });

  it("refuses a legacy French token — the server validates even though clients tolerate them", async () => {
    const id = await newLink();
    await expect(
      db.query(`update contact_links set etat = 'en pause' where id = $1`, [id]),
    ).rejects.toThrow();
  });

  // ONB-04 is 1..4. Out of range breaks the clients' ring layout maths, which
  // shows up as a mis-placed node rather than an error — so the DB refuses it.
  it.each([
    [1, "accepted"],
    [4, "accepted"],
    [null, "accepted"],
    [0, "rejected"],
    [5, "rejected"],
    [-1, "rejected"],
  ])("ONB-04: ring %s is %s", async (ring, outcome) => {
    const insert = db.query(
      `insert into contact_links (id, owner_id, ring, invited_phone_hash, updated_at) values ($1,'u1',$2,$3, now())`,
      [`ring-${ring}`, ring, `hash-ring-${ring}`],
    );
    if (outcome === "accepted") await expect(insert).resolves.toBeDefined();
    else await expect(insert).rejects.toThrow();
  });
});

describe("VLT-09 tombstones", () => {
  it("rejects a second LIVE edge to the same person", async () => {
    await db.exec(
      `insert into contact_links (id, owner_id, target_id, updated_at) values ('dup-a','u1','u2', now())`,
    );
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, target_id, updated_at) values ('dup-b','u1','u2', now())`,
      ),
    ).rejects.toThrow();
  });

  it("allows re-adding someone after their link is tombstoned", async () => {
    // The reason the unique index is partial. A plain unique would make
    // "delete a contact, then add them back" fail forever.
    await db.exec(`update contact_links set deleted_at = now() where id = 'dup-a'`);
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, target_id, updated_at) values ('dup-c','u1','u2', now())`,
      ),
    ).resolves.toBeDefined();
  });
});

describe("VLT-07 idempotency ledger", () => {
  it("rejects a replayed mutation id, so a retried write cannot double-apply", async () => {
    await db.exec(`insert into client_mutations (user_id, id) values ('u1','m-1')`);
    await expect(
      db.exec(`insert into client_mutations (user_id, id) values ('u1','m-1')`),
    ).rejects.toThrow();
  });

  it("scopes ids per user, so one account cannot collide with or probe another's", async () => {
    await expect(
      db.exec(`insert into client_mutations (user_id, id) values ('u2','m-1')`),
    ).resolves.toBeDefined();
  });
});

describe("cascades", () => {
  it("deleting a link removes its roles — no orphaned classification data", async () => {
    await db.exec(
      `insert into contact_links (id, owner_id, invited_phone_hash, updated_at) values ('casc','u1','hash-casc', now())`,
    );
    await db.exec(
      `insert into contact_roles (contact_link_id, role, updated_at) values ('casc','colleague', now())`,
    );
    await db.exec(`delete from contact_links where id = 'casc'`);
    const left = await db.query<{ n: number }>(
      `select count(*)::int as n from contact_roles where contact_link_id = 'casc'`,
    );
    expect(left.rows[0]?.n).toBe(0);
  });

  it("deleting a user removes their mutation ledger (IDT-04 cascade erasure)", async () => {
    await db.exec(`insert into users (id, phone_hash, display_name) values ('u3','h3','C')`);
    await db.exec(`insert into client_mutations (user_id, id) values ('u3','m-3')`);
    await db.exec(`delete from users where id = 'u3'`);
    const left = await db.query<{ n: number }>(
      `select count(*)::int as n from client_mutations where user_id = 'u3'`,
    );
    expect(left.rows[0]?.n).toBe(0);
  });

  /**
   * data-specialist.md rule 2: "account deletion must cascade to everything
   * (Vault, Device, ContactLink, Envie, EnvieRecipient, Match, Proposal) —
   * maintain a deletion integration test proving zero orphaned rows for a
   * deleted user." The tests above each prove one edge in isolation; this one
   * builds the full graph — including a link where the deleted user is the
   * *target*, not just the owner, and an envie the deleted user only
   * *receives*, not authors — and deletes once, at the root.
   */
  it("test_IDT04_deletion_zero_orphans: deleting a user cascades through the full object graph", async () => {
    await db.exec(
      `insert into users (id, phone_hash, display_name) values ('u-graph','h-graph','G'), ('u-graph-peer','h-graph-peer','P')`,
    );
    await db.exec(
      `insert into vaults (user_id, blob, version, updated_at) values ('u-graph', '\\x00', 1, now())`,
    );
    await db.exec(`insert into devices (id, user_id, platform) values ('device-graph', 'u-graph', 'IOS')`);
    // Link where u-graph is the owner, and one where u-graph is the target —
    // both FKs (owner_id, target_id) are onDelete: Cascade.
    await db.exec(
      `insert into contact_links (id, owner_id, target_id, updated_at) values ('link-out-graph','u-graph','u-graph-peer', now())`,
    );
    await db.exec(
      `insert into contact_roles (contact_link_id, role, updated_at) values ('link-out-graph','colleague', now())`,
    );
    await db.exec(
      `insert into contact_links (id, owner_id, target_id, updated_at) values ('link-in-graph','u-graph-peer','u-graph', now())`,
    );
    // An envie u-graph authors, and one u-graph only receives (peer's envie).
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values ('envie-authored-graph','u-graph','v','c', now() + interval '1 day')`,
    );
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values ('envie-peer-graph','u-graph-peer','v','c', now() + interval '1 day')`,
    );
    await db.exec(
      `insert into envie_recipients (envie_id, recipient_id) values ('envie-peer-graph','u-graph')`,
    );
    await db.exec(
      `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
         values ('match-graph','envie-authored-graph','envie-peer-graph','u-graph','u-graph-peer')`,
    );
    await db.exec(
      `insert into proposals (id, match_id, proposer_id) values ('proposal-graph','match-graph','u-graph')`,
    );

    await db.exec(`delete from users where id = 'u-graph'`);

    const orphans = await db.query<{ table_name: string; n: number }>(`
      select 'vault' as table_name, count(*)::int as n from vaults where user_id = 'u-graph'
      union all select 'device', count(*)::int from devices where user_id = 'u-graph'
      union all select 'contact_link_owner', count(*)::int from contact_links where owner_id = 'u-graph'
      union all select 'contact_link_target', count(*)::int from contact_links where target_id = 'u-graph'
      union all select 'contact_role', count(*)::int from contact_roles where contact_link_id = 'link-out-graph'
      union all select 'envie_authored', count(*)::int from envies where author_id = 'u-graph'
      union all select 'envie_recipient', count(*)::int from envie_recipients where recipient_id = 'u-graph'
      union all select 'match', count(*)::int from matches where user_a_id = 'u-graph' or user_b_id = 'u-graph'
      union all select 'proposal', count(*)::int from proposals where proposer_id = 'u-graph'
    `);
    expect(Object.fromEntries(orphans.rows.map((r) => [r.table_name, r.n]))).toEqual({
      vault: 0,
      device: 0,
      contact_link_owner: 0,
      contact_link_target: 0,
      contact_role: 0,
      envie_authored: 0,
      envie_recipient: 0,
      match: 0,
      proposal: 0,
    });
  });
});

describe("VLT-08 delta-pull index", () => {
  it("has the (owner, updatedAt) index the cursor pull depends on", async () => {
    const idx = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = 'contact_links'`,
    );
    expect(idx.rows.map((r) => r.indexname)).toContain("contact_links_owner_id_updated_at_idx");
  });
});

describe("SUG-DB-007 FK indexes", () => {
  /** Postgres never auto-indexes FK columns; Prisma only creates what's declared. */
  async function indexNames(table: string): Promise<string[]> {
    const idx = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = $1`,
      [table],
    );
    return idx.rows.map((r) => r.indexname);
  }

  it("indexes Device.userId — push fanout (IDT-05) + deletion cascade", async () => {
    expect(await indexNames("devices")).toContain("devices_user_id_idx");
  });

  it("indexes Envie.authorId — 'my active envies' (ENV-06) + deletion cascade", async () => {
    expect(await indexNames("envies")).toContain("envies_author_id_status_idx");
  });

  it("indexes both sides of Match — GET /matches is WHERE user_a_id = ? OR user_b_id = ?", async () => {
    const names = await indexNames("matches");
    expect(names).toContain("matches_user_a_id_idx");
    expect(names).toContain("matches_user_b_id_idx");
  });

  it("indexes Match.envieBId — the envie_a_id-leading unique doesn't cover envieB lookups", async () => {
    expect(await indexNames("matches")).toContain("matches_envie_b_id_idx");
  });

  it("indexes Proposal.matchId and proposerId — proposals-for-match (ENV-14) + both cascades", async () => {
    const names = await indexNames("proposals");
    expect(names).toContain("proposals_match_id_idx");
    expect(names).toContain("proposals_proposer_id_idx");
  });

  it("indexes ContactLink.targetId — deletion cascade + pending-link resolution (IDT-07)", async () => {
    expect(await indexNames("contact_links")).toContain("contact_links_target_id_idx");
  });
});

describe("SUG-DB-008 timestamptz columns", () => {
  /** ADR-001's new sync columns already shipped as timestamptz; this closes the gap on every pre-existing column. */
  async function dataType(table: string, column: string): Promise<string> {
    const res = await db.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_name = $1 and column_name = $2`,
      [table, column],
    );
    return res.rows[0]?.data_type ?? "";
  }

  it.each([
    ["users", "created_at"],
    ["vaults", "updated_at"],
    ["devices", "created_at"],
    ["contact_links", "created_at"],
    ["envies", "expires_at"],
    ["envies", "created_at"],
    ["envie_recipients", "created_at"],
    ["matches", "notified_at"],
    ["matches", "created_at"],
    ["proposals", "timeslot"],
    ["proposals", "created_at"],
  ])("%s.%s is timestamp with time zone", async (table, column) => {
    expect(await dataType(table, column)).toBe("timestamp with time zone");
  });

  it("round-trips the same instant regardless of session time zone (ENV-08 expiry comparisons)", async () => {
    const instant = "2026-09-01T12:00:00.000Z";
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('env-tz', 'u1', 'v', 'c', '${instant}')`,
    );
    await db.exec(`set time zone 'America/New_York'`);
    const read = await db.query<{ expires_at: string }>(
      `select expires_at from envies where id = 'env-tz'`,
    );
    await db.exec(`set time zone 'UTC'`);
    expect(new Date(read.rows[0]?.expires_at ?? "").toISOString()).toBe(instant);
  });
});

describe("SUG-DB-009 ContactLink integrity", () => {
  it("rejects a self-link", async () => {
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, target_id, updated_at) values ('self-1','u1','u1', now())`,
      ),
    ).rejects.toThrow(/contact_links_no_self_link/);
  });

  it("rejects a fully-orphaned row — no target and no discovery handle", async () => {
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, target_id, invited_phone_hash, updated_at)
           values ('orphan-1','u1',null,null, now())`,
      ),
    ).rejects.toThrow(/contact_links_resolved_or_pending/);
  });

  it("accepts two pending invites from the same owner to different phone hashes", async () => {
    await db.exec(
      `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
         values ('pending-a','u1','hash-a', now())`,
    );
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
           values ('pending-b','u1','hash-b', now())`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a second LIVE pending invite to the same phone hash", async () => {
    await db.exec(
      `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
         values ('dup-invite-a','u1','hash-dup', now())`,
    );
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
           values ('dup-invite-b','u1','hash-dup', now())`,
      ),
    ).rejects.toThrow(/contact_links_owner_id_invited_phone_hash_live_key/);
  });

  it("allows re-inviting the same phone hash once the earlier invite is tombstoned", async () => {
    await db.exec(`update contact_links set deleted_at = now() where id = 'dup-invite-a'`);
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
           values ('dup-invite-c','u1','hash-dup', now())`,
      ),
    ).resolves.toBeDefined();
  });

  it("resolution stays collision-free: nulling invited_phone_hash when target is set never blocks a fresh invite to that phone", async () => {
    // IDT-07 resolution contract: setting target_id clears invited_phone_hash
    // in the same update. NULLs are distinct in the unique index, so the
    // now-resolved row cannot collide with a later pending invite.
    await db.exec(`insert into users (id, phone_hash, display_name) values ('u-resolve','h-resolve','R')`);
    await db.exec(
      `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
         values ('resolve-a','u1','hash-resolve', now())`,
    );
    await db.exec(
      `update contact_links set target_id = 'u-resolve', invited_phone_hash = null where id = 'resolve-a'`,
    );
    await expect(
      db.exec(
        `insert into contact_links (id, owner_id, invited_phone_hash, updated_at)
           values ('resolve-b','u1','hash-resolve', now())`,
      ),
    ).resolves.toBeDefined();
  });

  it("deleting the target user removes the inbound link (Cascade), not a SetNull orphan", async () => {
    await db.exec(`insert into users (id, phone_hash, display_name) values ('u-casc','h-casc','C')`);
    await db.exec(
      `insert into contact_links (id, owner_id, target_id, updated_at) values ('casc-link','u1','u-casc', now())`,
    );
    await db.exec(`delete from users where id = 'u-casc'`);
    const left = await db.query<{ n: number }>(
      `select count(*)::int as n from contact_links where id = 'casc-link'`,
    );
    expect(left.rows[0]?.n).toBe(0);
  });
});

describe("ENV-09 match pair canonical order (SUG-DB-003)", () => {
  beforeAll(async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('env-e1', 'u1', 'v', 'c', now() + interval '1 day'),
         ('env-e2', 'u2', 'v', 'c', now() + interval '1 day')`,
    );
  });

  it("accepts the canonical order — envieAId lexicographically smaller than envieBId", async () => {
    await expect(
      db.exec(
        `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
           values ('match-canonical', 'env-e1', 'env-e2', 'u1', 'u2')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects the reversed pair with a CHECK violation, so a concurrent reversed insert cannot create a second match row", async () => {
    await expect(
      db.exec(
        `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
           values ('match-reversed', 'env-e2', 'env-e1', 'u2', 'u1')`,
      ),
    ).rejects.toThrow(/matches_pair_canonical_order/);
  });

  it("still rejects the same canonical pair inserted twice — the race's losing side", async () => {
    await expect(
      db.exec(
        `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
           values ('match-duplicate', 'env-e1', 'env-e2', 'u1', 'u2')`,
      ),
    ).rejects.toThrow(/matches_envie_a_id_envie_b_id_key/);
  });
});

/**
 * data-specialist.md rule 5: "keep an integration test that hammers
 * concurrent envie creation and proves single-match." PGlite is a
 * single-process engine, so it can't reproduce two separate Postgres
 * backends racing on the wire the way apps/api's real-Postgres suite could —
 * but firing both inserts via Promise.allSettled (rather than sequential
 * awaits, as the block above does) still proves the half of the guarantee
 * that lives in this layer: the `@@unique([envieAId, envieBId])` constraint
 * (SUG-DB-003) arbitrates the race so exactly one of two concurrent attempts
 * to record the same reciprocal pair ever persists, regardless of arrival
 * order — which is what backend code retrying on conflict depends on.
 */
describe("ENV-09 concurrent reciprocal envie creation (SUG-DB-004)", () => {
  beforeAll(async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('env-race-1', 'u1', 'v', 'c', now() + interval '1 day'),
         ('env-race-2', 'u2', 'v', 'c', now() + interval '1 day')`,
    );
  });

  it("test_ENV09_reciprocal_race_single_match: two concurrent inserts of the same canonical pair settle to exactly one match row", async () => {
    const results = await Promise.allSettled([
      db.exec(
        `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
           values ('match-race-a', 'env-race-1', 'env-race-2', 'u1', 'u2')`,
      ),
      db.exec(
        `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
           values ('match-race-b', 'env-race-1', 'env-race-2', 'u1', 'u2')`,
      ),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    const rows = await db.query<{ id: string }>(
      `select id from matches where envie_a_id = 'env-race-1' and envie_b_id = 'env-race-2'`,
    );
    expect(rows.rows).toHaveLength(1);
  });
});

describe("SUG-DB-005 Envie.verb nullable (30-day retention null-out)", () => {
  it("nulls verb on an expired envie without a NOT NULL violation, leaving category (the matching key) intact", async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, status, expires_at) values
         ('env-retention', 'u1', 'envie de courir au parc', 'sport', 'EXPIRED', now() - interval '31 days')`,
    );
    await expect(
      db.exec(`update envies set verb = NULL where id = 'env-retention'`),
    ).resolves.toBeDefined();
    const row = await db.query<{ verb: string | null; category: string }>(
      `select verb, category from envies where id = 'env-retention'`,
    );
    expect(row.rows[0]?.verb).toBeNull();
    expect(row.rows[0]?.category).toBe("sport");
  });
});

describe("SUG-DB-012 Vault quota CHECK + createdAt", () => {
  // Byte-length inspection is the one explicitly permitted operation on the
  // opaque blob (VLT-03) — a DB CHECK is invariant-compliant defense in depth
  // behind the route's 413 (apps/api MAX_VAULT_BYTES). updated_at is
  // Prisma-managed (`@updatedAt`, no DB default), so raw SQL inserts must set
  // it explicitly — same pattern as the other `@updatedAt` models above.
  it("accepts a blob at exactly the 1 MB quota boundary", async () => {
    const blob = Buffer.alloc(1_048_576);
    await expect(
      db.query(
        `insert into vaults (user_id, blob, version, updated_at) values ('u1', $1, 1, now())`,
        [blob],
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a blob one byte over the 1 MB quota", async () => {
    const blob = Buffer.alloc(1_048_577);
    await expect(
      db.query(
        `insert into vaults (user_id, blob, version, updated_at) values ('u2', $1, 1, now())`,
        [blob],
      ),
    ).rejects.toThrow(/vaults_blob_quota/);
  });

  it("defaults createdAt to now() on insert", async () => {
    await db.exec(
      `insert into users (id, phone_hash, display_name) values ('u-vault-created','h-vault-created','V')`,
    );
    await db.exec(
      `insert into vaults (user_id, blob, version, updated_at) values ('u-vault-created', '\\x00', 1, now())`,
    );
    const row = await db.query<{ created_at: string | null }>(
      `select created_at from vaults where user_id = 'u-vault-created'`,
    );
    expect(row.rows[0]?.created_at).not.toBeNull();
  });
});

describe("ENV-15 per-side pass (SUG-DB-006)", () => {
  beforeAll(async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('env-pass-1', 'u1', 'v', 'c', now() + interval '1 day'),
         ('env-pass-2', 'u2', 'v', 'c', now() + interval '1 day')`,
    );
    await db.exec(
      `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
         values ('match-pass', 'env-pass-1', 'env-pass-2', 'u1', 'u2')`,
    );
  });

  it("no longer accepts PASSED as a shared state value — it was removed from the enum", async () => {
    await expect(
      db.exec(`update matches set state = 'PASSED' where id = 'match-pass'`),
    ).rejects.toThrow();
  });

  it("records a pass on the private per-side column without touching the shared state", async () => {
    await db.exec(`update matches set passed_by_a_at = now() where id = 'match-pass'`);
    const row = await db.query<{ state: string; passed_by_a_at: string | null }>(
      `select state, passed_by_a_at from matches where id = 'match-pass'`,
    );
    expect(row.rows[0]?.state).toBe("OPEN");
    expect(row.rows[0]?.passed_by_a_at).not.toBeNull();
  });

  it("test_ENV15_pass_invisible_to_counterpart: a counterpart-shaped select stays bit-identical across a pass", async () => {
    const counterpartShape = async () =>
      (
        await db.query<{ state: string; notified_at: string | null; created_at: string }>(
          `select state, notified_at, created_at from matches where id = 'match-pass'`,
        )
      ).rows[0];
    const before = await counterpartShape();
    await db.exec(`update matches set passed_by_b_at = now() where id = 'match-pass'`);
    const after = await counterpartShape();
    expect(after).toEqual(before);
  });
});

describe("SUG-DB-013 string caps (defense in depth vs. the API contract)", () => {
  it("caps every column at the value the API contract already enforces", async () => {
    const res = await db.query<{
      table_name: string;
      column_name: string;
      character_maximum_length: number | null;
    }>(
      `select table_name, column_name, character_maximum_length
         from information_schema.columns
        where (table_name, column_name) in (
          ('users','phone_hash'), ('users','display_name'),
          ('envies','verb'), ('envies','category'),
          ('proposals','place'), ('devices','push_token')
        )`,
    );
    const caps = Object.fromEntries(
      res.rows.map((r) => [`${r.table_name}.${r.column_name}`, r.character_maximum_length]),
    );
    expect(caps).toEqual({
      "users.phone_hash": 128,
      "users.display_name": 50,
      "envies.verb": 200,
      "envies.category": 64,
      "proposals.place": 200,
      "devices.push_token": 4096,
    });
  });

  it("rejects a 129-char phoneHash, accepts the 128-char boundary", async () => {
    await expect(
      db.exec(
        `insert into users (id, phone_hash, display_name) values ('cap-phone-over','${"h".repeat(129)}','X')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into users (id, phone_hash, display_name) values ('cap-phone-ok','${"h".repeat(128)}','X')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a 51-char displayName, accepts the 50-char boundary", async () => {
    await expect(
      db.exec(
        `insert into users (id, phone_hash, display_name) values ('cap-name-over','hash-cap-name-over','${"n".repeat(51)}')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into users (id, phone_hash, display_name) values ('cap-name-ok','hash-cap-name-ok','${"n".repeat(50)}')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a 201-char verb, accepts the 200-char boundary (ENV-17)", async () => {
    await expect(
      db.exec(
        `insert into envies (id, author_id, verb, category, expires_at) values
           ('cap-verb-over','u1','${"v".repeat(201)}','sport', now() + interval '1 day')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into envies (id, author_id, verb, category, expires_at) values
           ('cap-verb-ok','u1','${"v".repeat(200)}','sport', now() + interval '1 day')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a 65-char category, accepts the 64-char boundary", async () => {
    await expect(
      db.exec(
        `insert into envies (id, author_id, verb, category, expires_at) values
           ('cap-cat-over','u1','v','${"c".repeat(65)}', now() + interval '1 day')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into envies (id, author_id, verb, category, expires_at) values
           ('cap-cat-ok','u1','v','${"c".repeat(64)}', now() + interval '1 day')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a 4097-char pushToken, accepts the 4096-char boundary", async () => {
    await expect(
      db.exec(
        `insert into devices (id, user_id, platform, push_token) values
           ('cap-push-over','u1','IOS','${"p".repeat(4097)}')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into devices (id, user_id, platform, push_token) values
           ('cap-push-ok','u1','IOS','${"p".repeat(4096)}')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a 201-char place, accepts the 200-char boundary", async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('cap-place-e1','u1','v','c', now() + interval '1 day'),
         ('cap-place-e2','u2','v','c', now() + interval '1 day')`,
    );
    await db.exec(
      `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
         values ('cap-place-match','cap-place-e1','cap-place-e2','u1','u2')`,
    );
    await expect(
      db.exec(
        `insert into proposals (id, match_id, proposer_id, place) values
           ('cap-place-over','cap-place-match','u1','${"p".repeat(201)}')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into proposals (id, match_id, proposer_id, place) values
           ('cap-place-ok','cap-place-match','u1','${"p".repeat(200)}')`,
      ),
    ).resolves.toBeDefined();
  });
});

describe("SUG-DB-015 updatedAt on stateful models", () => {
  /** @updatedAt is Prisma-client-managed, not a DB trigger — raw SQL sweeps
   * (expiry cron, etc.) must set updated_at = now() explicitly, same as the
   * migration comment documents. These tests exercise the DB-level contract
   * (column exists, defaults, type), not the client-side auto-touch, which
   * has no representation at the raw-SQL layer PGlite tests operate at. */
  async function dataType(table: string, column: string): Promise<string> {
    const res = await db.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_name = $1 and column_name = $2`,
      [table, column],
    );
    return res.rows[0]?.data_type ?? "";
  }

  it.each([
    ["envies", "updated_at"],
    ["matches", "updated_at"],
    ["proposals", "updated_at"],
    ["devices", "updated_at"],
  ])("%s.%s is timestamp with time zone", async (table, column) => {
    expect(await dataType(table, column)).toBe("timestamp with time zone");
  });

  it("defaults Envie.updatedAt to now() on insert", async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('env-updated-default', 'u1', 'v', 'c', now() + interval '1 day')`,
    );
    const row = await db.query<{ created_at: string; updated_at: string }>(
      `select created_at, updated_at from envies where id = 'env-updated-default'`,
    );
    expect(row.rows[0]?.updated_at).not.toBeNull();
    expect(new Date(row.rows[0]?.updated_at ?? "").getTime()).toBe(
      new Date(row.rows[0]?.created_at ?? "").getTime(),
    );
  });

  it("Envie.updatedAt advances on an explicit status-flip write while createdAt stays put (ENV-12)", async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, status, expires_at, created_at, updated_at) values
         ('env-updated-flip', 'u1', 'v', 'c', 'ACTIVE', now() + interval '1 day', now() - interval '1 hour', now() - interval '1 hour')`,
    );
    await db.exec(
      `update envies set status = 'WITHDRAWN', updated_at = now() where id = 'env-updated-flip'`,
    );
    const row = await db.query<{ created_at: string; updated_at: string }>(
      `select created_at, updated_at from envies where id = 'env-updated-flip'`,
    );
    expect(new Date(row.rows[0]?.updated_at ?? "").getTime()).toBeGreaterThan(
      new Date(row.rows[0]?.created_at ?? "").getTime(),
    );
  });

  it("defaults Match/Proposal/Device.updatedAt to now() on insert, backfilling pre-existing-shaped rows honestly", async () => {
    await db.exec(
      `insert into envies (id, author_id, verb, category, expires_at) values
         ('env-updated-m1', 'u1', 'v', 'c', now() + interval '1 day'),
         ('env-updated-m2', 'u2', 'v', 'c', now() + interval '1 day')`,
    );
    await db.exec(
      `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
         values ('match-updated', 'env-updated-m1', 'env-updated-m2', 'u1', 'u2')`,
    );
    await db.exec(
      `insert into proposals (id, match_id, proposer_id) values ('proposal-updated', 'match-updated', 'u1')`,
    );
    await db.exec(
      `insert into devices (id, user_id, platform) values ('device-updated', 'u1', 'IOS')`,
    );
    const [match, proposal, device] = await Promise.all([
      db.query<{ updated_at: string | null }>(`select updated_at from matches where id = 'match-updated'`),
      db.query<{ updated_at: string | null }>(`select updated_at from proposals where id = 'proposal-updated'`),
      db.query<{ updated_at: string | null }>(`select updated_at from devices where id = 'device-updated'`),
    ]);
    expect(match.rows[0]?.updated_at).not.toBeNull();
    expect(proposal.rows[0]?.updated_at).not.toBeNull();
    expect(device.rows[0]?.updated_at).not.toBeNull();
  });
});
