import type { QueryClient } from '@tanstack/react-query';

import { subscribeToAuthChanges } from './auth-api';

/**
 * Clears all cached server state when the signed-in account goes away or changes, so no data
 * from a previous account survives in memory:
 * - on SIGNED_OUT;
 * - when a session for a DIFFERENT user appears (e.g. signing in as B while A's session was
 *   still active, which Supabase reports as SIGNED_IN without a SIGNED_OUT).
 * Query keys are user-scoped as well; this is defence in depth. Returns an unsubscribe function.
 */
export function registerAuthCacheReset(queryClient: QueryClient): () => void {
  let lastUserId: string | null = null;
  return subscribeToAuthChanges((event, session) => {
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
  });
}
