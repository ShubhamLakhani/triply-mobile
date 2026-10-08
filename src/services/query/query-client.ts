import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { captureError } from '@/services/observability';
import { isNonRetryableError } from '@/utils/errors';

export const QUERY_MAX_RETRIES = 2;

/** Retry transient failures with backoff; never retry client errors (auth, validation, RLS). */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isNonRetryableError(error)) return false;
  return failureCount < QUERY_MAX_RETRIES;
}

/**
 * Server-state cache. Defaults:
 * - queries: 30s stale, 5m GC, retry ≤2 for transient errors, refetch on focus/reconnect
 * - mutations: no automatic retry (sensitive writes must be explicitly idempotent to opt in)
 * - every failed query/mutation is reported to observability without payload data
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => captureError(error, { source: 'query' }),
    }),
    mutationCache: new MutationCache({
      onError: (error) => captureError(error, { source: 'mutation' }),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
