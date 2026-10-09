/** Keys for reports the signed-in user SUBMITTED (reports against them are never readable). */
export const reportKeys = {
  all: ['reports'] as const,
  own: (userId: string) => ['reports', 'own', userId] as const,
};
