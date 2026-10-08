import { createContext, useContext, type ReactNode } from 'react';

import type { AnalyticsClient } from './analytics-client';
import type { AnalyticsEventMap } from './events';

export type AppAnalytics = AnalyticsClient<AnalyticsEventMap>;

const AnalyticsContext = createContext<AppAnalytics | null>(null);

export function AnalyticsProvider({
  client,
  children,
}: {
  client: AppAnalytics;
  children: ReactNode;
}) {
  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AppAnalytics {
  const client = useContext(AnalyticsContext);
  if (!client) {
    throw new Error('useAnalytics must be used inside <AnalyticsProvider>.');
  }
  return client;
}
