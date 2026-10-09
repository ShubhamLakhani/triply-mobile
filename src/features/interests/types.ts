import type { Tables } from '@/services/supabase';

/** Full catalog row (generated types; never hand-written). */
export type Interest = Tables<'interests'>;

/** Client-facing interest fields (clients only ever see active interests). */
export type InterestSummary = Pick<Interest, 'id' | 'slug' | 'label' | 'category'>;

export type ProfileInterest = Tables<'profile_interests'>;

/**
 * A selection with its catalog entry. `interest` is null if the interest was deactivated
 * after it was selected (RLS hides inactive catalog rows).
 */
export type OwnInterest = Pick<ProfileInterest, 'interest_id' | 'created_at'> & {
  interest: InterestSummary | null;
};

/** Mirrors the database limit enforced by private.profile_interests_before_insert(). */
export const MAX_INTERESTS = 10;
