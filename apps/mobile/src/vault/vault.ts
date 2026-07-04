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
}

export interface VaultData {
  contacts: VaultContact[];
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
  cache = JSON.parse(decryptVault(blob, key)) as VaultData;
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
  return (await hydrate()).contacts;
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

export async function setRing(id: string, ring: IntimacyRing): Promise<void> {
  await mutateContact(id, (c) => {
    c.ring = ring;
  });
}

export async function setEtat(id: string, etat: string | undefined): Promise<void> {
  await mutateContact(id, (c) => {
    if (etat === undefined) {
      delete c.etat;
    } else {
      c.etat = etat;
    }
  });
}

export async function setRessenti(id: string, ressenti: string | undefined): Promise<void> {
  await mutateContact(id, (c) => {
    if (ressenti === undefined) {
      delete c.ressenti;
    } else {
      c.ressenti = ressenti;
    }
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
