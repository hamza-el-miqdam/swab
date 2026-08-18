/**
 * Deterministic synthetic seed — no faker, no randomness, fixed clock (Data
 * Steward rule 4: reproducible, entirely synthetic, tiny for the free tier).
 *
 * Covers: 6 users, devices, mutual + pending contact links WITH their
 * classification (ADR-001: rings, états, ressentis, rôles), a reciprocal envie
 * pair producing exactly 1 match, a pending proposal, and an expired envie.
 * Also two deprecated Vault rows, kept only while the blob endpoints still
 * exist (removed at ADR-001 stage 3/4 with the model).
 *
 * The classification values are as synthetic as the rest — invented people,
 * invented opinions. They exist so a developer can see the four axes render
 * without hand-writing SQL, not to resemble anyone.
 *
 * Run: pnpm --filter @repo/db db:seed   (dev/preview branches only — wipes data)
 *
 * SUG-DB-010: the wipe refuses to run against NODE_ENV=production or any
 * non-local/compose host, unless SEED_ALLOW_WIPE=1 is set (see canWipe()
 * below and packages/db/.env.example) — preview/CI branches opt in explicitly.
 */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  Etat,
  EnvieStatus,
  MatchState,
  Platform,
  PrismaClient,
  ProposalState,
  Ressenti,
  RoleContexte,
} from "@prisma/client";

const prisma = new PrismaClient();

/** Synthetic phone hashes: sha256 of a fixed label — obviously fake, never derived from real numbers (G1). */
export function syntheticPhoneHash(label: string): string {
  return createHash("sha256").update(`swab-seed:${label}`).digest("hex");
}

/**
 * SUG-DB-010 — guards the destructive `deleteMany()` sweep below. Pure and
 * DB-less so it's unit-testable: never NODE_ENV=production, and otherwise
 * only local/compose hosts (or an explicit SEED_ALLOW_WIPE=1 opt-in, for
 * disposable preview/CI branches).
 */
export function canWipe(url: string, env: { NODE_ENV?: string; SEED_ALLOW_WIPE?: string }): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.SEED_ALLOW_WIPE === "1") return true;
  try {
    // local + docker-compose service host (docker-compose.yml's `db` service)
    return /localhost|127\.0\.0\.1|(^|@)db:/.test(new URL(url).host);
  } catch {
    return false;
  }
}

const T0 = new Date("2026-07-01T09:00:00.000Z"); // fixed clock — reproducible timestamps

export function hoursFromT0(n: number): Date {
  return new Date(T0.getTime() + n * 3_600_000);
}

async function createUser(key: string, displayName: string): Promise<{ id: string }> {
  return prisma.user.create({
    data: { phoneHash: syntheticPhoneHash(key), displayName, createdAt: T0 },
    select: { id: true },
  });
}

async function main(): Promise<void> {
  // SUG-DB-010: refuse to run against anything but a local/compose DB or an
  // explicit opt-in — the wipe below is unrecoverable (Vault blobs especially).
  if (!canWipe(process.env.DATABASE_URL ?? "", process.env)) {
    process.stderr.write(
      "seed refused: destructive seed only runs against local/compose DBs or with SEED_ALLOW_WIPE=1\n",
    );
    process.exit(2);
  }

  // Wipe in FK-safe order — idempotent re-seed on disposable branches only.
  await prisma.proposal.deleteMany();
  await prisma.match.deleteMany();
  await prisma.envieRecipient.deleteMany();
  await prisma.envie.deleteMany();
  await prisma.contactRole.deleteMany();
  await prisma.contactLink.deleteMany();
  await prisma.clientMutation.deleteMany();
  await prisma.device.deleteMany();
  await prisma.vault.deleteMany();
  await prisma.user.deleteMany();

  const amina = await createUser("amina", "Amina");
  const bilal = await createUser("bilal", "Bilal");
  const chirine = await createUser("chirine", "Chirine");
  const daoud = await createUser("daoud", "Daoud");
  const emna = await createUser("emna", "Emna");
  const farid = await createUser("farid", "Farid");

  // DEPRECATED (ADR-001): kept only until the blob endpoints go at stage 3/4.
  // Opaque synthetic bytes — content is meaningless by design (VLT-03).
  await prisma.vault.create({
    data: { userId: amina.id, blob: Buffer.from("synthetic-opaque-vault-amina"), version: 3 },
  });
  await prisma.vault.create({
    data: { userId: bilal.id, blob: Buffer.from("synthetic-opaque-vault-bilal"), version: 1 },
  });

  await prisma.device.create({
    data: { userId: amina.id, platform: Platform.IOS, pushToken: "synthetic-push-token-amina", createdAt: T0 },
  });
  await prisma.device.create({
    data: { userId: bilal.id, platform: Platform.ANDROID, pushToken: null, createdAt: T0 },
  });

  // Edges AND the owner's classification of the target (ADR-001). Links stay
  // directional (IDT-08): amina→bilal and bilal→amina are two independent rows
  // with unrelated values, which is the point — neither can see the other's.
  //
  // Deliberately asymmetric: amina puts bilal in ring 1 and reads him as
  // `positive`, while bilal puts amina in ring 3 and `ambivalent`. A symmetric
  // seed would let a broken reverse-read query pass unnoticed.
  const edges: ReadonlyArray<{
    ownerId: string;
    targetId: string;
    displayName: string;
    ring: number;
    etat: Etat | null;
    ressenti: Ressenti | null;
    roles: RoleContexte[];
  }> = [
    { ownerId: amina.id, targetId: bilal.id, displayName: "Bilal", ring: 1, etat: Etat.AVAILABLE, ressenti: Ressenti.POSITIVE, roles: [RoleContexte.FAMILY, RoleContexte.COHORT] },
    { ownerId: bilal.id, targetId: amina.id, displayName: "Amina", ring: 3, etat: Etat.BUSY, ressenti: Ressenti.AMBIVALENT, roles: [RoleContexte.COHORT] },
    { ownerId: amina.id, targetId: chirine.id, displayName: "Chirine", ring: 2, etat: Etat.PAUSED, ressenti: Ressenti.POSITIVE, roles: [RoleContexte.COLLEAGUE, RoleContexte.COHORT] },
    { ownerId: chirine.id, targetId: amina.id, displayName: "Amina", ring: 2, etat: null, ressenti: null, roles: [RoleContexte.COLLEAGUE] },
    { ownerId: bilal.id, targetId: daoud.id, displayName: "Daoud", ring: 4, etat: Etat.AWAY, ressenti: Ressenti.NEGATIVE, roles: [RoleContexte.NEIGHBOR] },
    { ownerId: emna.id, targetId: farid.id, displayName: "Farid", ring: 1, etat: null, ressenti: null, roles: [RoleContexte.PARTNER, RoleContexte.COMMUNITY] },
  ];
  for (const edge of edges) {
    await prisma.contactLink.create({
      data: {
        ownerId: edge.ownerId,
        targetId: edge.targetId,
        displayName: edge.displayName,
        ring: edge.ring,
        etat: edge.etat,
        ressenti: edge.ressenti,
        createdAt: T0,
        // Field-level LWW timestamps (VLT-09) start at the seed clock, so a
        // dev's first real edit always wins over seeded data.
        displayNameUpdatedAt: T0,
        ringUpdatedAt: T0,
        etatUpdatedAt: edge.etat ? T0 : null,
        ressentiUpdatedAt: edge.ressenti ? T0 : null,
        lastAxisChangeAt: T0,
        roles: { create: edge.roles.map((role) => ({ role, createdAt: T0 })) },
      },
    });
  }
  // Pending invite: target not yet a member (IDT-07) — fully classifiable
  // anyway (FCH-08), which is why displayName lives on the link and not only
  // on the absent User row.
  await prisma.contactLink.create({
    data: {
      ownerId: amina.id,
      targetId: null,
      invitedPhoneHash: syntheticPhoneHash("invitee-pending"),
      displayName: "Invité",
      ring: 3,
      etat: Etat.AVAILABLE,
      createdAt: T0,
      displayNameUpdatedAt: T0,
      ringUpdatedAt: T0,
      etatUpdatedAt: T0,
      lastAxisChangeAt: T0,
      roles: { create: [{ role: RoleContexte.COMMUNITY, createdAt: T0 }] },
    },
  });

  // A tombstoned link (VLT-09): deleted, not gone. Proves the partial unique
  // lets the same person be re-added, and gives the delta-pull endpoint
  // something to return as a deletion.
  await prisma.contactLink.create({
    data: {
      ownerId: emna.id,
      targetId: daoud.id,
      displayName: "Daoud",
      ring: 4,
      createdAt: T0,
      deletedAt: T0,
    },
  });

  // Reciprocal envie pair → exactly one match:
  // amina ∈ recipients(envieB) ∧ bilal ∈ recipients(envieA) ∧ same category ∧ both unexpired.
  const envieA = await prisma.envie.create({
    data: {
      authorId: amina.id,
      verb: "envie de courir au parc",
      category: "sport",
      status: EnvieStatus.ACTIVE,
      expiresAt: hoursFromT0(48),
      createdAt: hoursFromT0(1),
      recipients: {
        create: [
          { recipientId: bilal.id, createdAt: hoursFromT0(1) },
          { recipientId: chirine.id, createdAt: hoursFromT0(1) },
        ],
      },
    },
    select: { id: true },
  });
  const envieB = await prisma.envie.create({
    data: {
      authorId: bilal.id,
      verb: "envie d'aller courir",
      category: "sport",
      status: EnvieStatus.ACTIVE,
      expiresAt: hoursFromT0(48),
      createdAt: hoursFromT0(2),
      recipients: { create: [{ recipientId: amina.id, createdAt: hoursFromT0(2) }] },
    },
    select: { id: true },
  });
  // SUG-DB-003 (ENV-09): envieAId must be the lexicographically smaller id —
  // cuid() creation order does not guarantee that, so sort before insert
  // (the same rule Backend follows at match-creation time), swapping the
  // author mapping to match.
  const [canonicalEnvieAId, canonicalEnvieBId] =
    envieA.id < envieB.id ? [envieA.id, envieB.id] : [envieB.id, envieA.id];
  const [canonicalUserAId, canonicalUserBId] =
    canonicalEnvieAId === envieA.id ? [amina.id, bilal.id] : [bilal.id, amina.id];
  const match = await prisma.match.create({
    data: {
      envieAId: canonicalEnvieAId,
      envieBId: canonicalEnvieBId,
      userAId: canonicalUserAId,
      userBId: canonicalUserBId,
      state: MatchState.OPEN,
      notifiedAt: hoursFromT0(2), // both sides notified atomically
      createdAt: hoursFromT0(2),
    },
    select: { id: true },
  });
  await prisma.proposal.create({
    data: {
      matchId: match.id,
      proposerId: amina.id,
      place: "Parc de la Tête d'Or",
      timeslot: hoursFromT0(72),
      state: ProposalState.PENDING,
      createdAt: hoursFromT0(3),
    },
  });

  // An expired envie with no reciprocal counterpart (status-flip retention model).
  await prisma.envie.create({
    data: {
      authorId: chirine.id,
      verb: "envie de bruncher dimanche",
      category: "food",
      status: EnvieStatus.EXPIRED,
      expiresAt: hoursFromT0(-2),
      createdAt: hoursFromT0(-50),
      recipients: { create: [{ recipientId: amina.id, createdAt: hoursFromT0(-50) }] },
    },
  });

  // G3: counts only — no verbs, no recipient lists, no hashes on stdout.
  const summary = {
    users: await prisma.user.count(),
    vaults: await prisma.vault.count(),
    devices: await prisma.device.count(),
    contactLinks: await prisma.contactLink.count(),
    contactRoles: await prisma.contactRole.count(),
    envies: await prisma.envie.count(),
    envieRecipients: await prisma.envieRecipient.count(),
    matches: await prisma.match.count(),
    proposals: await prisma.proposal.count(),
  };
  process.stdout.write(`${JSON.stringify({ seed: "ok", counts: summary })}\n`);
}

// SUG-DB-010: only run when this file is executed directly (`tsx prisma/seed.ts`),
// not when a test imports it to exercise canWipe() — importing must never wipe a DB.
const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (err: unknown) => {
      process.stderr.write(`seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
      await prisma.$disconnect();
      process.exit(1);
    });
}
