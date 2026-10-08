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
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
