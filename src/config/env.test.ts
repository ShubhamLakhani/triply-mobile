import { isForbiddenSupabaseKey, parseEnv, type RawEnv } from './env';

const PUBLISHABLE_KEY = 'sb_publishable_test_0123456789abcdef';
// Assembled at runtime so the repository secret scanner (scripts/check-security.mjs) stays strict.
const FAKE_SECRET_KEY = ['sb', 'secret', 'fake0123456789abcdefghij'].join('_');

function raw(overrides: Partial<RawEnv> = {}): RawEnv {
  return {
    appVariant: 'development',
    supabaseUrl: 'https://abcd1234.supabase.co',
    supabasePublishableKey: PUBLISHABLE_KEY,
    posthogKey: undefined,
    posthogHost: undefined,
    analyticsEnabled: undefined,
    sentryDsn: undefined,
    ...overrides,
  };
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeJwt(payload: object): string {
  return `${base64Url('{"alg":"HS256","typ":"JWT"}')}.${base64Url(JSON.stringify(payload))}.signature`;
}

describe('parseEnv', () => {
  it('accepts a minimal valid development configuration', () => {
    const result = parseEnv(raw());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.appVariant).toBe('development');
      expect(result.env.analyticsEnabled).toBe(false);
      expect(result.env.sentryDsn).toBeUndefined();
    }
  });

  it('reports missing required variables by name without leaking values', () => {
    const result = parseEnv(raw({ supabaseUrl: undefined, supabasePublishableKey: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          { variable: 'EXPO_PUBLIC_SUPABASE_URL', message: 'is missing' },
          { variable: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', message: 'is missing' },
        ]),
      );
    }
  });

  it('rejects an unknown app variant', () => {
    const result = parseEnv(raw({ appVariant: 'staging' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.variable).toBe('APP_VARIANT');
  });

  it('rejects Supabase secret and service-role keys', () => {
    const secret = parseEnv(raw({ supabasePublishableKey: FAKE_SECRET_KEY }));
    const serviceRole = parseEnv(
      raw({ supabasePublishableKey: fakeJwt({ role: 'service_role', iss: 'supabase' }) }),
    );
    for (const result of [secret, serviceRole]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual({
          variable: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
          message: expect.stringContaining('SECRET/service-role') as string,
        });
      }
    }
  });

  it('allows a legacy anon JWT key', () => {
    expect(isForbiddenSupabaseKey(fakeJwt({ role: 'anon', iss: 'supabase' }))).toBe(false);
  });

  it('allows http only for local development backends', () => {
    expect(parseEnv(raw({ supabaseUrl: 'http://127.0.0.1:54321' })).ok).toBe(true);
    const preview = parseEnv(
      raw({
        appVariant: 'preview',
        supabaseUrl: 'http://127.0.0.1:54321',
        sentryDsn: 'https://key@o1.ingest.sentry.io/1',
      }),
    );
    expect(preview.ok).toBe(false);
  });

  it('requires a Sentry DSN outside development', () => {
    const result = parseEnv(raw({ appVariant: 'production' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.variable)).toContain('EXPO_PUBLIC_SENTRY_DSN');
    }
  });

  it('requires PostHog key and host only when analytics is enabled', () => {
    expect(parseEnv(raw({ analyticsEnabled: 'false' })).ok).toBe(true);
    const enabled = parseEnv(raw({ analyticsEnabled: 'true' }));
    expect(enabled.ok).toBe(false);
    const configured = parseEnv(
      raw({
        analyticsEnabled: 'true',
        posthogKey: 'phc_test',
        posthogHost: 'https://eu.i.posthog.com',
      }),
    );
    expect(configured.ok).toBe(true);
  });
});
