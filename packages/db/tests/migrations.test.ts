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
 */
let seq = 0;
async function newLink(): Promise<string> {
  const id = `link-${++seq}`;
  await db.query(
    `insert into contact_links (id, owner_id, updated_at) values ($1, 'u1', now())`,
    [id],
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
      `insert into contact_links (id, owner_id, ring, updated_at) values ($1,'u1',$2, now())`,
      [`ring-${ring}`, ring],
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
      `insert into contact_links (id, owner_id, updated_at) values ('casc','u1', now())`,
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

  it("indexes ContactLink.targetId — the SetNull scan + pending-link resolution (IDT-07)", async () => {
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
