import type { AppEnv } from '@/config/env';

import { createAnalyticsClient } from './analytics-client';
import type { AppAnalytics } from './AnalyticsProvider';
import type { AnalyticsEventMap } from './events';
import { createPostHogTransport } from './posthog-transport';

export function createAppAnalytics(env: AppEnv): AppAnalytics {
  return createAnalyticsClient<AnalyticsEventMap>(createPostHogTransport(env));
}

export { AnalyticsProvider, useAnalytics, type AppAnalytics } from './AnalyticsProvider';
export {
  createAnalyticsClient,
  assertOpaqueIdentity,
  AnalyticsIdentityError,
  type AnalyticsClient,
  type AnalyticsTransport,
} from './analytics-client';
export type { AnalyticsEventMap, AnalyticsProperties } from './events';
