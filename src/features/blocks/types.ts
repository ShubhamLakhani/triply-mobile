import type { Tables } from '@/services/supabase';

/**
 * One of the signed-in user's OUTGOING blocks. Blocks against the user are never readable,
 * so there is deliberately no "who blocked me" type or query.
 */
export type OwnBlock = Pick<Tables<'user_blocks'>, 'blocked_user_id' | 'created_at'>;

/** True if the signed-in user has blocked `targetUserId` (own block list only). */
export function isBlockedByMe(blocks: readonly OwnBlock[], targetUserId: string): boolean {
  return blocks.some((block) => block.blocked_user_id === targetUserId);
}
