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
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
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
