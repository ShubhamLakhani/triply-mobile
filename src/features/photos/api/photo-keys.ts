/** Keys for the signed-in user's profile photos and short-lived signed URLs. */
export const photoKeys = {
  all: ['photos'] as const,
  own: (userId: string) => ['photos', 'own', userId] as const,
  signedUrl: (storagePath: string) => ['photos', 'signed-url', storagePath] as const,
};
