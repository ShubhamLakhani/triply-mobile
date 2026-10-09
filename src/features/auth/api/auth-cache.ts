import type { QueryClient } from '@tanstack/react-query';

import { subscribeToAuthChanges } from './auth-api';

/**
 * Clears all cached server state when the user signs out so no profile data from the
 * previous account survives in memory. Returns an unsubscribe function.
 */
export function registerAuthCacheReset(queryClient: QueryClient): () => void {
  return subscribeToAuthChanges((event) => {
    if (event === 'SIGNED_OUT') {
      queryClient.clear();
    }
  });
}
