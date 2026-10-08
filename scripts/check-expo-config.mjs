#!/usr/bin/env node
/**
 * Evaluates the real Expo config (via `expo config`) for every APP_VARIANT and asserts the
 * identifiers, schemes and release-critical settings. Uses placeholder public values only.
 */
import { execFileSync } from 'node:child_process';

const EXPECTED = {
  development: { id: 'cc.toolmint.triply.dev', scheme: 'triply-dev', name: 'Triply (Dev)' },
  preview: { id: 'cc.toolmint.triply.preview', scheme: 'triply-preview', name: 'Triply (Preview)' },
  production: { id: 'cc.toolmint.triply', scheme: 'triply', name: 'Triply' },
};

const failures = [];

for (const [variant, expected] of Object.entries(EXPECTED)) {
  const output = execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_VARIANT: variant,
      EXPO_NO_TELEMETRY: '1',
      EXPO_OFFLINE: '1',
    },
  });
  const config = JSON.parse(output);
  const check = (label, actual, wanted) => {
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      failures.push(
        `[${variant}] ${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`,
      );
    }
  };
  check('name', config.name, expected.name);
  check('ios.bundleIdentifier', config.ios?.bundleIdentifier, expected.id);
  check('android.package', config.android?.package, expected.id);
  check('scheme', config.scheme, expected.scheme);
  check('runtimeVersion', config.runtimeVersion, { policy: 'appVersion' });
  check('ios.supportsTablet', config.ios?.supportsTablet, false);
  check('android.allowBackup', config.android?.allowBackup, false);
  check('userInterfaceStyle', config.userInterfaceStyle, 'light');
  check('extra.appVariant', config.extra?.appVariant, variant);
  console.log(`[${variant}] ${config.name} · ${config.ios?.bundleIdentifier} · ${config.scheme}`);
}

if (failures.length > 0) {
  console.error('Expo config check FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('Expo config check passed for development, preview and production.');
