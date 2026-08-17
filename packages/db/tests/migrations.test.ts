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
    ).rejects.toThrow();
  });

  it("still rejects the same canonical pair inserted twice — the race's losing side", async () => {
    await expect(
      db.exec(
        `insert into matches (id, envie_a_id, envie_b_id, user_a_id, user_b_id)
           values ('match-duplicate', 'env-e1', 'env-e2', 'u1', 'u2')`,
      ),
    ).rejects.toThrow();
  });
});
