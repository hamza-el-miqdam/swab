/**
 * jest-expo preset; coverage threshold configured per package (G2 — not
 * globally fudged). react-native-quick-crypto is mapped to node:crypto in
 * tests: identical API surface, so the vault crypto property test exercises
 * real AES-256-GCM.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^react-native-quick-crypto$': '<rootDir>/test/quick-crypto-node.js',
  },
  // pnpm keeps the real files under node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/,
  // so the allowlist lookahead must accept an optional `.pnpm/<dir>/node_modules/`
  // prefix — otherwise every RN/Expo package is skipped by Babel and suites
  // fail on untransformed Flow/ESM syntax.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.tsx',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
