import type { ExpoConfig } from 'expo/config';

import appConfig, { assertBackendMatchesVariant, resolveAppVariant } from '../../app.config';

function buildConfig(variant: string | undefined): ExpoConfig {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return appConfig({
      config: {},
      projectRoot: process.cwd(),
      staticConfigPath: null,
      packageJsonPath: null,
    });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

describe('app.config.ts', () => {
  it.each([
    ['development', 'Triply (Dev)', 'cc.toolmint.triply.dev', 'triply-dev'],
    ['preview', 'Triply (Preview)', 'cc.toolmint.triply.preview', 'triply-preview'],
    ['production', 'Triply', 'cc.toolmint.triply', 'triply'],
  ])('configures the %s variant', (variant, name, identifier, scheme) => {
    const config = buildConfig(variant);
    expect(config.name).toBe(name);
    expect(config.ios?.bundleIdentifier).toBe(identifier);
    expect(config.android?.package).toBe(identifier);
    expect(config.scheme).toBe(scheme);
    expect(config.extra?.appVariant).toBe(variant);
  });

  it('defaults to development when APP_VARIANT is unset', () => {
    expect(buildConfig(undefined).ios?.bundleIdentifier).toBe('cc.toolmint.triply.dev');
  });

  it('uses the appVersion runtime policy, phone-only iOS and no Android backups', () => {
    const config = buildConfig('production');
    expect(config.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(config.ios?.supportsTablet).toBe(false);
    expect(config.android?.allowBackup).toBe(false);
    expect(config.userInterfaceStyle).toBe('light');
    expect(config.platforms).toEqual(['ios', 'android']);
  });

  it('rejects unknown variants', () => {
    expect(() => resolveAppVariant('staging')).toThrow(/Invalid APP_VARIANT/);
  });

  it('blocks non-production builds from using the production backend', () => {
    expect(() =>
      assertBackendMatchesVariant('preview', 'https://prodref123.supabase.co', 'prodref123'),
    ).toThrow(/PRODUCTION Supabase project/);
    expect(() =>
      assertBackendMatchesVariant('production', 'https://prodref123.supabase.co', 'prodref123'),
    ).not.toThrow();
    expect(() =>
      assertBackendMatchesVariant('preview', 'https://stagingref.supabase.co', 'prodref123'),
    ).not.toThrow();
  });
});
