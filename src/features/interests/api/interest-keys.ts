/** TanStack Query keys for interests. The catalog is shared; selections are per user. */
export const interestKeys = {
  all: ['interests'] as const,
  catalog: () => ['interests', 'catalog'] as const,
  own: (userId: string) => ['interests', 'own', userId] as const,
};
