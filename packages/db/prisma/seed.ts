/**
 * Deterministic synthetic seed — no faker, no randomness, fixed clock (Data
 * Steward rule 4: reproducible, entirely synthetic, tiny for the free tier).
 *
 * Covers: 6 users, vaults (opaque bytes), devices, mutual + pending contact
 * links, a reciprocal envie pair producing exactly 1 match, a pending
 * proposal, and an expired envie.
 *
 * Run: pnpm --filter @repo/db db:seed   (dev/preview branches only — wipes data)
 */
import { createHash } from "node:crypto";
import {
  EnvieStatus,
  MatchState,
  Platform,
  PrismaClient,
  ProposalState,
} from "@prisma/client";

const prisma = new PrismaClient();

/** Synthetic phone hashes: sha256 of a fixed label — obviously fake, never derived from real numbers (G1). */
export function syntheticPhoneHash(label: string): string {
  return createHash("sha256").update(`swab-seed:${label}`).digest("hex");
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
  // Wipe in FK-safe order — idempotent re-seed on disposable branches only.
  await prisma.proposal.deleteMany();
  await prisma.match.deleteMany();
  await prisma.envieRecipient.deleteMany();
  await prisma.envie.deleteMany();
  await prisma.contactLink.deleteMany();
  await prisma.device.deleteMany();
  await prisma.vault.deleteMany();
  await prisma.user.deleteMany();

  const amina = await createUser("amina", "Amina");
  const bilal = await createUser("bilal", "Bilal");
  const chirine = await createUser("chirine", "Chirine");
  const daoud = await createUser("daoud", "Daoud");
  const emna = await createUser("emna", "Emna");
  const farid = await createUser("farid", "Farid");

  // Vaults: opaque synthetic bytes — content is meaningless by design (VLT-03).
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

  // Edges only — classification lives in the owners' vaults. Links are directional (IDT-08).
  const edges: ReadonlyArray<readonly [string, string]> = [
    [amina.id, bilal.id],
    [bilal.id, amina.id],
    [amina.id, chirine.id],
    [chirine.id, amina.id],
    [bilal.id, daoud.id],
    [emna.id, farid.id],
  ];
  for (const [ownerId, targetId] of edges) {
    await prisma.contactLink.create({ data: { ownerId, targetId, createdAt: T0 } });
  }
  // Pending invite: target not yet a member (IDT-07).
  await prisma.contactLink.create({
    data: {
      ownerId: amina.id,
      targetId: null,
      invitedPhoneHash: syntheticPhoneHash("invitee-pending"),
      createdAt: T0,
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
  const match = await prisma.match.create({
    data: {
      envieAId: envieA.id,
      envieBId: envieB.id,
      userAId: amina.id,
      userBId: bilal.id,
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
    envies: await prisma.envie.count(),
    envieRecipients: await prisma.envieRecipient.count(),
    matches: await prisma.match.count(),
    proposals: await prisma.proposal.count(),
  };
  process.stdout.write(`${JSON.stringify({ seed: "ok", counts: summary })}\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    process.stderr.write(`seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
