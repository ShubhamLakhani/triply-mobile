import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { captureError } from '@/services/observability';
import { TRIPLY_SQLSTATE } from '@/services/supabase/sqlstate';
import { getErrorCode, isNonRetryableError } from '@/utils/errors';

export const QUERY_MAX_RETRIES = 2;

/**
 * Key prefix of the caller's account-state query (features/account/api/account-keys.ts). It is
 * re-fetched whenever the server rejects a request because the account is not active, so the
 * root router switches to the restricted-account screen without waiting for a refocus.
 */
export const ACCOUNT_STATE_QUERY_PREFIX = ['account'] as const;

/** A typed feature error (`account_inactive`) or the raw Postgres SQLSTATE (TR001). */
export function isAccountInactiveFailure(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 'account_inactive' || code === TRIPLY_SQLSTATE.accountInactive;
}

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
 * - an `account_inactive` failure re-fetches the account state (see above)
 */
export function createQueryClient(): QueryClient {
  const onAccountInactive = (error: unknown) => {
    if (isAccountInactiveFailure(error)) {
      void client.invalidateQueries({ queryKey: ACCOUNT_STATE_QUERY_PREFIX });
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        captureError(error, { source: 'query' });
        onAccountInactive(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        captureError(error, { source: 'mutation' });
        onAccountInactive(error);
      },
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
  return client;
}
