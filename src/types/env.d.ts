/**
 * Public, build-time-inlined environment variables. Keep in sync with .env.example and
 * scripts/check-security.mjs (EXPO_PUBLIC allowlist).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    readonly EXPO_PUBLIC_POSTHOG_KEY?: string;
    readonly EXPO_PUBLIC_POSTHOG_HOST?: string;
    readonly EXPO_PUBLIC_ANALYTICS_ENABLED?: string;
    readonly EXPO_PUBLIC_SENTRY_DSN?: string;
  }
}
