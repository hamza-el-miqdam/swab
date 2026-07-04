# Swab (صواب) — Domain Spec & Data Model v0.1

Derived from the six standalone screen blueprints in `/blueprints` (extracted 2026-07-04). This is the Architect agent's Stage-0 input: approve/edit it, then it becomes GitHub issues.

---

## 1. Product model (as expressed by the screens)

**Concept:** "Jouer franc jeu" — say what you want, to whom you want, without ever having to ask. Swab only reveals a desire if it's shared by the other side. No counters, no gamification, no "match!" fanfare, no silent hiding.

| Screen | What it establishes |
|---|---|
| **Onboarding** | Radial calibration: « moi » at center, each contact placed on a chosen intimacy ring. State/feeling layer optional, collapsed by default. Promise: *« Tout reste chiffré sur ton téléphone… personne — ni eux, ni nous — ne voit comment tu l'as remplie. »* |
| **Carte des relations** | Main view. Nav: Carte / Envie / Sous-groupes. Contact axes visible: Intimité, État, Rôles. Tap → fiche. |
| **Fiche contact** | Four editable axes per relation: **Intimité, Rôles·contexte, État, Ressenti** — declared by the user, never inferred (*« tu déclares, swab ne devine pas »*). Classification is **asymmetric and private**; reciprocity signal deliberately soft. Relation history feed; gentle re-tag prompt after long inactivity. |
| **Sous-groupes** | Auto-detected via **formal concept analysis** on the tags — never created manually. User can only pin / rename / hide. Hierarchical (a subgroup can contain another). ~30 tagged contacts → 15–25 ready-to-use scopes (*portées*). |
| **Flux envie & match** | Emit: verb in present tense (*« envie de… »*) → choose a **portée, not a person** → **transparent filtering** (included vs filtered-by-rules lists shown; any exclusion revocable at send; *« rien n'est masqué en silence »*) → send. Receive: match notified **both sides simultaneously**; soft exit *« Passer cette fois »* that tells the other side nothing. On match: propose place / propose time / pass. |
| **Paramètres modaux** | État/ressenti don't define scopes — they **filter at send time**. Three levels per sensitive case: **veto absolu** (never included, even forced), **exclu par défaut** (revocable at send), **priorité basse** (included, de-emphasized). All filtering visible at send. |

## 2. Privacy architecture — ASSUMED: hybrid local-first ⚠️

*(Flagged assumption — the privacy question wasn't answered; full-E2E and server-side variants remain open.)*

- **On-device only (backed up as an encrypted blob the server cannot read):** the four classification axes, filtering rules (3 levels), subgroup detection (FCA runs client-side), relation history feed, re-tag nudges.
- **Server-visible (minimum needed to match):** account identity, contact graph edges (who is linked to whom — not how they're classified), emitted envies (verb + final resolved recipient list), matches, proposals, push tokens.
- **Consequence:** the client resolves a *portée* to a concrete recipient list locally before sending; the server never learns scope names, rings, or filter reasons. The soft "Passer cette fois" is a client-side state the counterpart is never told about.
- **Consequence for FCA:** runs on-device over local tags — fits the promise, and 30–50 contacts is trivially cheap to compute locally.

## 3. Matching semantics (v0 proposal — needs your confirmation)

A **match** occurs when envie E₁ from user A and envie E₂ from user B satisfy: A ∈ recipients(E₂) ∧ B ∈ recipients(E₁) ∧ compatible(E₁, E₂) ∧ both unexpired. For the POC, `compatible` = same normalized **category** (client suggests a category from the free-text verb; exact-verb matching is too brittle, semantic matching too heavy for v0). Notification fires both sides atomically; neither side ever learns of a non-match.

## 4. Prisma schema draft v0.1 (`packages/db/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  phoneHash     String    @unique // E.164 hashed — contact discovery without storing raw numbers
  displayName   String
  createdAt     DateTime  @default(now())
  vault         Vault?
  devices       Device[]
  linksOut      ContactLink[] @relation("owner")
  linksIn       ContactLink[] @relation("target")
  envies        Envie[]
  matchesA      Match[]   @relation("userA")
  matchesB      Match[]   @relation("userB")
  proposals     Proposal[]
}

/// Encrypted client-side; server stores an opaque blob (classification axes,
/// filter rules, subgroups, relation history). Key never leaves the device.
model Vault {
  userId    String   @id
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  blob      Bytes
  version   Int      @default(1)
  updatedAt DateTime @updatedAt
}

model Device {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pushToken String?
  platform  Platform
  createdAt DateTime @default(now())
}

/// Edge only — HOW the owner classifies the target lives in the owner's Vault.
model ContactLink {
  id           String   @id @default(cuid())
  ownerId      String
  owner        User     @relation("owner", fields: [ownerId], references: [id], onDelete: Cascade)
  targetId     String?  // null until the invited person joins
  target       User?    @relation("target", fields: [targetId], references: [id], onDelete: SetNull)
  invitedPhoneHash String? // discovery handle while target is null
  createdAt    DateTime @default(now())

  @@unique([ownerId, targetId])
  @@index([invitedPhoneHash])
}

model Envie {
  id         String   @id @default(cuid())
  authorId   String
  author     User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  verb       String   // « envie de… », present tense, as spoken
  category   String   // client-suggested normalized category — matching key
  status     EnvieStatus @default(ACTIVE)
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  recipients EnvieRecipient[]
  matchesA   Match[]  @relation("envieA")
  matchesB   Match[]  @relation("envieB")

  @@index([category, status, expiresAt])
}

/// Final resolved list only — scope names and filter reasons never reach the server.
model EnvieRecipient {
  envieId     String
  envie       Envie   @relation(fields: [envieId], references: [id], onDelete: Cascade)
  recipientId String
  createdAt   DateTime @default(now())

  @@id([envieId, recipientId])
  @@index([recipientId])
}

model Match {
  id         String      @id @default(cuid())
  envieAId   String
  envieA     Envie       @relation("envieA", fields: [envieAId], references: [id], onDelete: Cascade)
  envieBId   String
  envieB     Envie       @relation("envieB", fields: [envieBId], references: [id], onDelete: Cascade)
  userAId    String
  userA      User        @relation("userA", fields: [userAId], references: [id], onDelete: Cascade)
  userBId    String
  userB      User        @relation("userB", fields: [userBId], references: [id], onDelete: Cascade)
  state      MatchState  @default(OPEN)
  notifiedAt DateTime?
  createdAt  DateTime    @default(now())
  proposals  Proposal[]

  @@unique([envieAId, envieBId])
}

model Proposal {
  id         String        @id @default(cuid())
  matchId    String
  match      Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  proposerId String
  proposer   User          @relation(fields: [proposerId], references: [id], onDelete: Cascade)
  place      String?
  timeslot   DateTime?
  state      ProposalState @default(PENDING)
  createdAt  DateTime      @default(now())
}

enum Platform { IOS ANDROID WEB }
enum EnvieStatus { ACTIVE EXPIRED WITHDRAWN }
enum MatchState { OPEN PROPOSED SCHEDULED PASSED EXPIRED }   // PASSED is private to the passer
enum ProposalState { PENDING ACCEPTED DECLINED LAPSED }
```

Validate with `npx prisma validate` before the Data Agent's first migration.

## 5. API surface sketch (`apps/api`, standalone Fastify/Hono per §8.2 of the blueprint)

`POST /auth/otp` · `POST /vault` (opaque blob up/down-sync) · `POST /contacts/link` + `POST /contacts/discover` (phone-hash batch) · `POST /envies` (verb, category, expiresAt, recipientIds[]) · `DELETE /envies/:id` (withdraw) · matching runs transactionally on envie creation (no cron dependency; expiry sweep = daily Actions cron) · `GET /matches` · `POST /matches/:id/pass` (silent) · `POST /matches/:id/proposals` · `POST /proposals/:id/accept|decline`.

## 6. Agent assignment for Sprint 1 (feeds the blueprint's Stage 1–2)

1. `area:db` — schema above, migration `init`, seed script with synthetic users/envies (Data Agent, sequential gate).
2. `area:api` — auth OTP + vault sync + contact discovery (Copilot coding agent).
3. `area:mobile` — onboarding flow + radial calibration UI from the Onboarding blueprint (Antigravity, design-heavy).
4. `area:mobile` — carte des relations read-only rendering (Antigravity).
5. `area:web` — minimal account/invite landing (Copilot).
6. `area:sre` — CI pipeline + Neon branch GC + Actions migration workflow (Copilot CLI).

## 7. Open questions

1. **Matching key:** is client-suggested `category` acceptable for v0, or do you want free-verb semantic matching (embeddings) from the start? Category is deterministic and debuggable; embeddings are magical but add an ML dependency and false-positive risk on a product whose whole ethos is trust.
2. **Identity & discovery:** phone-number OTP with hashed-number contact discovery (assumed above, matches "Importer mes contacts") — confirm? It's the natural fit but sets an SMS cost floor and complicates web login; email magic-link is cheaper but kills contact import.
3. **Privacy model confirmation** (skipped earlier): the hybrid local-first assumption in §2 — confirm or redirect before the Data Agent's first migration, since full-E2E would replace `Envie.verb/category` with blind match tokens.
