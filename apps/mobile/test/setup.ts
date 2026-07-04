/**
 * Global test doubles for Expo native modules. Backing stores live on
 * globalThis so jest.resetModules() (used to simulate process restarts in
 * ONB-08 tests) does not wipe "disk" state — matching real device behavior.
 */
import { createHash, randomUUID } from 'node:crypto';

interface Stores {
  kv: Map<string, string>;
  secure: Map<string, string>;
}

const g = globalThis as typeof globalThis & { __swabTestStores?: Stores };
g.__swabTestStores ??= { kv: new Map(), secure: new Map() };
const stores = g.__swabTestStores;

export function resetTestStores(): void {
  stores.kv.clear();
  stores.secure.clear();
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => undefined,
    getFirstAsync: async (_sql: string, key: string) => {
      const value = stores.kv.get(key);
      return value === undefined ? null : { value };
    },
    runAsync: async (_sql: string, key: string, value: string) => {
      stores.kv.set(key, value);
    },
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => stores.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    stores.secure.set(key, value);
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => randomUUID(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, data: string) =>
    createHash('sha256').update(data).digest('hex'),
}));

jest.mock('expo-contacts', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getContactsAsync: jest.fn(async () => ({ data: [] })),
  Fields: { PhoneNumbers: 'phoneNumbers' },
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

afterEach(() => {
  resetTestStores();
});
