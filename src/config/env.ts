import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Runtime configuration for the mobile app.
 *
 * Only EXPO_PUBLIC_* values are available here and every one of them ships inside the app binary,
 * so they must be public by design (RLS-protected Supabase publishable key, PostHog project key,
 * Sentry DSN). This module refuses secret-looking Supabase keys outright.
 */

export const appVariantSchema = z.enum(['development', 'preview', 'production']);
export type AppVariant = z.infer<typeof appVariantSchema>;

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const booleanFlag = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => value === 'true');

/** Raw shape read from process.env / expo-constants. All values are untrusted strings. */
export interface RawEnv {
  appVariant: unknown;
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  posthogKey: string | undefined;
  posthogHost: string | undefined;
  analyticsEnabled: string | undefined;
  sentryDsn: string | undefined;
}

/** Variable names as users configure them, used in error messages (never values). */
export const ENV_VAR_NAMES: Record<keyof RawEnv, string> = {
  appVariant: 'APP_VARIANT',
  supabaseUrl: 'EXPO_PUBLIC_SUPABASE_URL',
  supabasePublishableKey: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  posthogKey: 'EXPO_PUBLIC_POSTHOG_KEY',
  posthogHost: 'EXPO_PUBLIC_POSTHOG_HOST',
  analyticsEnabled: 'EXPO_PUBLIC_ANALYTICS_ENABLED',
  sentryDsn: 'EXPO_PUBLIC_SENTRY_DSN',
};

function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * Detects keys that must never ship in a client:
 * - new-style Supabase secret keys (`sb_secret_...`)
 * - legacy JWT keys whose payload role is `service_role`
 */
export function isForbiddenSupabaseKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length === 3 && parts[1]) {
    const payload = decodeBase64Url(parts[1]);
    if (payload && /"role"\s*:\s*"service_role"/.test(payload)) return true;
  }
  return false;
}

const envSchema = z
  .object({
    appVariant: appVariantSchema,
    supabaseUrl: z.url({ protocol: /^https?$/ }),
    supabasePublishableKey: z.string().trim().min(20, 'looks too short to be a publishable key'),
    posthogKey: optionalString,
    posthogHost: z
      .url({ protocol: /^https$/ })
      .optional()
      .or(z.literal('').transform(() => undefined)),
    analyticsEnabled: booleanFlag,
    sentryDsn: z
      .url({ protocol: /^https$/ })
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .superRefine((env, ctx) => {
    if (isForbiddenSupabaseKey(env.supabasePublishableKey)) {
      ctx.addIssue({
        code: 'custom',
        path: ['supabasePublishableKey'],
        message: 'is a SECRET/service-role key. Only the publishable key may ship in the app.',
      });
    }
    if (env.appVariant !== 'development' && !env.supabaseUrl.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['supabaseUrl'],
        message: 'must use https outside development.',
      });
    }
    if (env.appVariant !== 'development' && !env.sentryDsn) {
      ctx.addIssue({
        code: 'custom',
        path: ['sentryDsn'],
        message: 'is required for preview and production builds.',
      });
    }
    if (env.analyticsEnabled && (!env.posthogKey || !env.posthogHost)) {
      ctx.addIssue({
        code: 'custom',
        path: [env.posthogKey ? 'posthogHost' : 'posthogKey'],
        message: 'is required when EXPO_PUBLIC_ANALYTICS_ENABLED=true.',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export interface EnvIssue {
  variable: string;
  message: string;
}

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; issues: EnvIssue[] };

function variableNameForPath(path: readonly PropertyKey[]): string {
  const key = path[0];
  if (typeof key === 'string' && key in ENV_VAR_NAMES) {
    return ENV_VAR_NAMES[key as keyof RawEnv];
  }
  return String(key ?? 'environment');
}

/** Pure parser — safe to unit test. Issue messages never include configured values. */
export function parseEnv(raw: RawEnv): EnvResult {
  const result = envSchema.safeParse(raw);
  if (result.success) return { ok: true, env: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      variable: variableNameForPath(issue.path),
      message:
        issue.code === 'invalid_type' && issue.input === undefined ? 'is missing' : issue.message,
    })),
  };
}

/**
 * Reads the raw environment. EXPO_PUBLIC_* must be referenced statically
 * (`process.env.EXPO_PUBLIC_<NAME>`) so Metro can inline them at build time.
 */
export function readRawEnv(): RawEnv {
  const extra: unknown = Constants.expoConfig?.extra;
  const appVariant =
    typeof extra === 'object' && extra !== null && 'appVariant' in extra
      ? (extra as { appVariant: unknown }).appVariant
      : undefined;

  return {
    appVariant,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    analyticsEnabled: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  };
}

let cached: EnvResult | undefined;

/** Parses once per process. */
export function loadEnv(): EnvResult {
  cached ??= parseEnv(readRawEnv());
  return cached;
}

export class EnvValidationError extends Error {
  readonly issues: EnvIssue[];

  constructor(issues: EnvIssue[]) {
    super(
      `Invalid app configuration:\n${issues.map((i) => `- ${i.variable} ${i.message}`).join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/** Returns the validated env or throws a descriptive EnvValidationError. */
export function getEnv(): AppEnv {
  const result = loadEnv();
  if (!result.ok) throw new EnvValidationError(result.issues);
  return result.env;
}
