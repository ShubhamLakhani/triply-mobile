/** TanStack Query keys for the signed-in user's discovery preferences. */
export const preferenceKeys = {
  all: ['preferences'] as const,
  discovery: (userId: string) => ['preferences', 'discovery', userId] as const,
  genders: (userId: string) => ['preferences', 'genders', userId] as const,
};
