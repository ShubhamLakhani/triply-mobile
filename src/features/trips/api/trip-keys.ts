/**
 * TanStack Query keys for the signed-in user's trips. Detail keys are nested under `own`, so
 * invalidating `own(userId)` refreshes both the list and any open trip detail.
 */
export const tripKeys = {
  all: ['trips'] as const,
  own: (userId: string) => ['trips', 'own', userId] as const,
  detail: (userId: string, tripId: string) => ['trips', 'own', userId, 'detail', tripId] as const,
};
