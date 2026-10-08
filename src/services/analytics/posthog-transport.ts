import PostHog from 'posthog-react-native';

import type { AppEnv } from '@/config/env';

import type { AnalyticsTransport } from './analytics-client';

export function shouldEnableAnalytics(env: AppEnv): boolean {
  if (process.env.JEST_WORKER_ID !== undefined) return false;
  return env.analyticsEnabled && Boolean(env.posthogKey && env.posthogHost);
}

/**
 * Creates the PostHog transport, or null when analytics is disabled (tests, missing config, or
 * EXPO_PUBLIC_ANALYTICS_ENABLED !== 'true').
 *
 * Privacy defaults: no session replay, no autocapture (no PostHogProvider autocapture is used),
 * person profiles only for identified users.
 */
export function createPostHogTransport(env: AppEnv): AnalyticsTransport | null {
  if (!shouldEnableAnalytics(env) || !env.posthogKey || !env.posthogHost) return null;

  const client = new PostHog(env.posthogKey, {
    host: env.posthogHost,
    enableSessionReplay: false,
    captureAppLifecycleEvents: false,
    personProfiles: 'identified_only',
    persistence: 'file',
  });

  return {
    capture: (event, properties) => {
      void client.capture(event, properties);
    },
    identify: (distinctId) => {
      void client.identify(distinctId);
    },
    reset: () => {
      void client.reset();
    },
  };
}
