// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/**
 * Architecture guardrails: vendor SDKs may only be imported from their service module.
 * Screens and components go through src/services/* (and, from Phase 1M, src/features/*\/api).
 */
const restrictedVendorImports = [
  {
    name: '@supabase/supabase-js',
    message: 'Import Supabase only inside src/services/supabase or a feature api/ module.',
  },
  {
    name: 'posthog-react-native',
    message: 'Use the typed analytics service in src/services/analytics.',
  },
  {
    name: 'expo-notifications',
    message: 'Use the notification service in src/services/notifications.',
  },
  {
    name: '@sentry/react-native',
    message: 'Use the observability service in src/services/observability.',
  },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'ios/**',
      'android/**',
      'coverage/**',
      'node_modules/**',
      'expo-env.d.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-restricted-imports': ['error', { paths: restrictedVendorImports }],
    },
  },
  {
    // Service modules that own each vendor SDK.
    files: [
      'src/services/supabase/**',
      'src/services/analytics/**',
      'src/services/notifications/**',
      'src/services/observability/**',
      'src/features/*/api/**',
      'app/_layout.tsx',
      'tests/**',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js', 'metro.config.js'],
    rules: {
      'no-console': 'off',
    },
  },
]);
