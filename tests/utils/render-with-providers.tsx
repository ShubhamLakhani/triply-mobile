import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import {
  AnalyticsProvider,
  createAnalyticsClient,
  type AnalyticsTransport,
} from '@/services/analytics';

/** Query + analytics providers for component tests (auth is mocked per test). */
export function createTestProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const transport: AnalyticsTransport = {
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  };
  const analytics = createAnalyticsClient(transport);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AnalyticsProvider client={analytics}>{children}</AnalyticsProvider>
    </QueryClientProvider>
  );
  return { queryClient, transport, wrapper };
}
