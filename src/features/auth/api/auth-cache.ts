import type { QueryClient } from '@tanstack/react-query';

import { subscribeToAuthChanges, type AuthChangeEvent, type Session } from './auth-api';

export type AuthChangeHandler = (event: AuthChangeEvent, session: Session | null) => void;

/**
 * Builds the handler that clears all cached server state when the signed-in account goes
 * away or changes, so no data from a previous account survives in memory:
 * - on SIGNED_OUT;
 * - when a session for a DIFFERENT user appears (account switch reported as SIGNED_IN).
 * Query keys are user-scoped as well; this is defence in depth.
 */
export function createAuthCacheReset(queryClient: QueryClient): AuthChangeHandler {
  let lastUserId: string | null = null;
  return (event, session) => {
    if (event === 'SIGNED_OUT') {
      queryClient.clear();
      lastUserId = null;
      return;
    }
    const userId = session?.user.id ?? null;
    if (userId === null) return;
    if (lastUserId !== null && userId !== lastUserId) {
      queryClient.clear();
    }
    lastUserId = userId;
  };
}

/**
 * Standalone subscription variant (used by tests and non-provider contexts). The app itself
 * feeds the handler from the single AuthProvider subscription instead.
 */
export function registerAuthCacheReset(queryClient: QueryClient): () => void {
  return subscribeToAuthChanges(createAuthCacheReset(queryClient));
}
