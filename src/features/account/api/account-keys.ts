/**
 * TanStack Query keys for the caller's account state. The root `['account']` prefix is also
 * invalidated globally whenever any request fails with `account_inactive` (query-client.ts).
 */
export const accountKeys = {
  all: ['account'] as const,
  own: (userId: string) => ['account', 'own', userId] as const,
};
