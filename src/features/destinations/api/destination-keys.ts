/** TanStack Query keys for the destination catalog (same for every signed-in user). */
export const destinationKeys = {
  all: ['destinations'] as const,
  list: () => ['destinations', 'list'] as const,
  detail: (slug: string) => ['destinations', 'detail', slug] as const,
};
