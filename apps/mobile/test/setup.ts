/**
 * Global test doubles for Expo native modules. Backing stores live on
 * globalThis so jest.resetModules() (used to simulate process restarts in
 * ONB-08 tests) does not wipe "disk" state — matching real device behavior.
 *
 * Names referenced inside jest.mock() factories are `mock`-prefixed:
 * jest.mock calls are hoisted above imports, and babel-plugin-jest-hoist
 * only allows out-of-scope variables with that prefix.
 */
import { setUpTests } from 'react-native-reanimated';

import { createHash as mockCreateHash, randomUUID as mockRandomUUID } from 'node:crypto';

setUpTests(); // reanimated jest matchers (toHaveAnimatedStyle) + timer glue

interface Stores {
  kv: Map<string, string>;
  secure: Map<string, string>;
}

const g = globalThis as typeof globalThis & { __swabTestStores?: Stores };
g.__swabTestStores ??= { kv: new Map(), secure: new Map() };
const mockStores = g.__swabTestStores;

export function resetTestStores(): void {
  mockStores.kv.clear();
  mockStores.secure.clear();
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => undefined,
    getFirstAsync: async (_sql: string, key: string) => {
      const value = mockStores.kv.get(key);
      return value === undefined ? null : { value };
    },
    runAsync: async (_sql: string, key: string, value: string) => {
      mockStores.kv.set(key, value);
    },
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStores.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStores.secure.set(key, value);
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_alg: string, data: string) =>
    mockCreateHash('sha256').update(data).digest('hex'),
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
