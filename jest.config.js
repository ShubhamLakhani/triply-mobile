/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Resolve the JS (non-native) implementation of react-native-worklets under Jest (Reanimated 4).
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/', '/dist/', '/ios/', '/android/'],
  // Component/navigation tests are fast once Babel's transform cache is warm (~30 s for the
  // whole suite), but a cold cache (fresh CI runner, `--clearCache`) makes every worker
  // transform React Native + Expo Router first, and single tests then exceed Jest's 5 s
  // default under CPU contention. CI also caches the transform directory (see ci.yml).
  testTimeout: 30_000,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
