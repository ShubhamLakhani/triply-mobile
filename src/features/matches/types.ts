import type { Tables } from '@/services/supabase';

/** Canonical match row (generated types): user_low_id < user_high_id. */
export type Match = Tables<'matches'>;

/** A match from the signed-in user's point of view. */
export type OwnMatch = Match & {
  /** The other participant. */
  other_user_id: string;
  /** False once either participant unmatched (terminal in this phase). */
  is_active: boolean;
};

export function toOwnMatch(match: Match, userId: string): OwnMatch {
  return {
    ...match,
    other_user_id: match.user_low_id === userId ? match.user_high_id : match.user_low_id,
    is_active: match.unmatched_at === null,
  };
}
