/** Keys for the signed-in user's OUTGOING blocks (incoming blocks are never readable). */
export const blockKeys = {
  all: ['blocks'] as const,
  own: (userId: string) => ['blocks', 'own', userId] as const,
};
