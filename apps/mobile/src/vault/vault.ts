/**
 * The on-device vault (mobile rules 1–3, FS-07 VLT-01).
 *
 * All four classification axes live HERE and only here: intimité (ring),
 * rôles, état, ressenti. In memory while the app runs; at rest as an
 * AES-256-GCM blob in SQLite. Nothing in this module talks to the network —
 * sync.ts ships the ciphertext, never the fields.
 */
import { randomUUID } from 'expo-crypto';

import { kvGet, kvSet } from '../lib/db';
import { decryptVault, encryptVault, getOrCreateVaultKey } from './crypto';

export type IntimacyRing = 1 | 2 | 3 | 4;

export type VaultAxis = 'ring' | 'roles' | 'etat' | 'ressenti';

/**
 * FCH-01/FCH-04 — one coarse event per change, vault-only. No free text:
 * `value` is the raw stored value (ring number as string, vocab word,
 * joined roles), `match` events carry neither axis nor value.
 */
export interface VaultHistoryEvent {
  id: string;
  /** Epoch milliseconds. */
  at: number;
  kind: 'axis-change' | 'reconfirm' | 'match';
  axis?: VaultAxis;
  value?: string;
}

export interface VaultContact {
  id: string;
  displayName: string;
  /** Client-side hash (IDT-06); stays local until FS-07 discovery runs. */
  phoneHash?: string;
  /** Intimité — 1 = innermost ring. Unset until calibrated (ONB-04). */
  ring?: IntimacyRing;
  roles: string[];
  etat?: string;
  ressenti?: string;
  /** FCH-08: set by FS-07 discovery once they join swab; absent = pending. */
  linkedUserId?: string;
  /** Epoch ms; absent on pre-FS-03 contacts (staleness then stays silent). */
  createdAt?: number;
  /** FCH-01/04: newest last in storage; presentation sorts/windows it. */
  history: VaultHistoryEvent[];
  /** FCH-05: « À revoir plus tard » timestamp — quiet, 30-day re-eligibility. */
  retagSnoozedAt?: number;
}

export interface VaultData {
  contacts: VaultContact[];
}

/** Pre-FS-03 blobs lack roles/history on some contacts — default them sanely. */
type StoredVaultContact = Omit<VaultContact, 'roles' | 'history'> & {
  roles?: string[];
  history?: VaultHistoryEvent[];
};

function reviveVault(json: string): VaultData {
  const stored = JSON.parse(json) as { contacts: StoredVaultContact[] };
  return {
    contacts: stored.contacts.map((c) => ({
      ...c,
      roles: c.roles ?? [],
      history: c.history ?? [],
    })),
  };
}

const BLOB_KEY = 'vault.blob.v1';
const VERSION_KEY = 'vault.version.v1';

let cache: VaultData | null = null;
let version = 1;

async function hydrate(): Promise<VaultData> {
  if (cache !== null) {
    return cache;
  }
  const [blob, storedVersion] = await Promise.all([kvGet(BLOB_KEY), kvGet(VERSION_KEY)]);
  version = storedVersion === null ? 1 : Number.parseInt(storedVersion, 10);
  if (blob === null) {
    cache = { contacts: [] };
    return cache;
  }
  const key = await getOrCreateVaultKey();
  cache = reviveVault(decryptVault(blob, key));
  return cache;
}

async function persist(data: VaultData): Promise<void> {
  const key = await getOrCreateVaultKey();
  version += 1;
  await Promise.all([
    kvSet(BLOB_KEY, encryptVault(JSON.stringify(data), key)),
    kvSet(VERSION_KEY, String(version)),
  ]);
}

export async function getContacts(): Promise<readonly VaultContact[]> {
  // Fresh array + fresh entries (roles/history included): callers must never
  // hold a live reference into the cache, and React state updates need a new
  // identity after each mutation (same-reference setState skips the re-render).
  return (await hydrate()).contacts.map((c) => ({
    ...c,
    roles: [...c.roles],
    history: c.history.map((e) => ({ ...e })),
  }));
}

export async function addContact(input: {
  displayName: string;
  phoneHash?: string;
}): Promise<VaultContact> {
  const data = await hydrate();
  const contact: VaultContact = {
    id: randomUUID(),
    displayName: input.displayName,
    roles: [],
    history: [],
    createdAt: Date.now(),
    ...(input.phoneHash !== undefined ? { phoneHash: input.phoneHash } : {}),
  };
  data.contacts.push(contact);
  await persist(data);
  return contact;
}

async function mutateContact(
  id: string,
  mutate: (contact: VaultContact) => void,
): Promise<void> {
  const data = await hydrate();
  const contact = data.contacts.find((c) => c.id === id);
  if (contact === undefined) {
    return;
  }
  mutate(contact);
  await persist(data);
}

/** FCH-01: every axis edit appends a coarse history event, locally. */
function appendAxisEvent(contact: VaultContact, axis: VaultAxis, value: string | undefined): void {
  contact.history.push({
    id: randomUUID(),
    at: Date.now(),
    kind: 'axis-change',
    axis,
    ...(value !== undefined ? { value } : {}),
  });
}

export async function setRing(id: string, ring: IntimacyRing): Promise<void> {
  await mutateContact(id, (c) => {
    c.ring = ring;
    appendAxisEvent(c, 'ring', String(ring));
  });
}

export async function setRoles(id: string, roles: readonly string[]): Promise<void> {
  await mutateContact(id, (c) => {
    c.roles = [...roles];
    appendAxisEvent(c, 'roles', roles.length > 0 ? roles.join(' · ') : undefined);
  });
}

export async function setEtat(id: string, etat: string | undefined): Promise<void> {
  await mutateContact(id, (c) => {
    if (etat === undefined) {
      delete c.etat;
    } else {
      c.etat = etat;
    }
    appendAxisEvent(c, 'etat', etat);
  });
}

export async function setRessenti(id: string, ressenti: string | undefined): Promise<void> {
  await mutateContact(id, (c) => {
    if (ressenti === undefined) {
      delete c.ressenti;
    } else {
      c.ressenti = ressenti;
    }
    appendAxisEvent(c, 'ressenti', ressenti);
  });
}

/** FCH-05 « C’est toujours ça » — resets the staleness timer via the feed. */
export async function reconfirmAxes(id: string): Promise<void> {
  await mutateContact(id, (c) => {
    c.history.push({ id: randomUUID(), at: Date.now(), kind: 'reconfirm' });
    delete c.retagSnoozedAt;
  });
}

/** FCH-05 « À revoir plus tard » — quiet dismissal, re-eligible after 30 days. */
export async function snoozeRetag(id: string): Promise<void> {
  await mutateContact(id, (c) => {
    c.retagSnoozedAt = Date.now();
  });
}

/** FCH-04: coarse match event for the feed — no verb, no payload (FS-05 will call). */
export async function recordMatch(id: string): Promise<void> {
  await mutateContact(id, (c) => {
    c.history.push({ id: randomUUID(), at: Date.now(), kind: 'match' });
  });
}

/** FCH-08: FS-07 discovery will call this when the contact joins swab. */
export async function linkContact(id: string, linkedUserId: string): Promise<void> {
  await mutateContact(id, (c) => {
    c.linkedUserId = linkedUserId;
  });
}

/** Ciphertext + version for sync.ts — the only exit door (mobile rule 2). */
export async function getEncryptedVault(): Promise<{ blob: string; version: number }> {
  const data = await hydrate();
  let blob = await kvGet(BLOB_KEY);
  if (blob === null) {
    await persist(data);
    blob = await kvGet(BLOB_KEY);
  }
  if (blob === null) {
    throw new Error('vault blob unavailable');
  }
  return { blob, version };
}

export async function setVaultVersion(next: number): Promise<void> {
  version = next;
  await kvSet(VERSION_KEY, String(next));
}

/** Test seam: drops in-memory state, simulating a process restart. */
export function __resetVaultForTests(): void {
  cache = null;
  version = 1;
}
