/** Keys for the signed-in user's matches. Detail keys are nested under `own`. */
export const matchKeys = {
  all: ['matches'] as const,
  own: (userId: string) => ['matches', 'own', userId] as const,
  detail: (userId: string, matchId: string) =>
    ['matches', 'own', userId, 'detail', matchId] as const,
};
