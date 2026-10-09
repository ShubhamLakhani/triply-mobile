/** Keys for the signed-in user's OUTGOING decisions (incoming decisions are never readable). */
export const decisionKeys = {
  all: ['decisions'] as const,
  own: (userId: string) => ['decisions', 'own', userId] as const,
  forTarget: (userId: string, targetUserId: string) =>
    ['decisions', 'own', userId, 'target', targetUserId] as const,
};
