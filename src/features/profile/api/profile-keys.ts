/** TanStack Query keys for profile server state. Never mirror these into Zustand. */
export const profileKeys = {
  all: ['profile'] as const,
  own: (userId: string) => ['profile', 'own', userId] as const,
};
