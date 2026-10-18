import { getSupabaseClient } from '@/services/supabase';

import { interestSelectionSchema } from '../schemas/interest.schema';
import type { InterestSummary, OwnInterest } from '../types';

import { InterestError, toInterestError } from './interest-errors';

export const INTEREST_COLUMNS = 'id, slug, label, category' as const;
export const OWN_INTEREST_SELECT =
  `interest_id, created_at, interest:interests(${INTEREST_COLUMNS})` as const;

/** Active interest catalog, grouped-friendly order (category, then label). */
export async function fetchActiveInterests(): Promise<InterestSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from('interests')
    .select(INTEREST_COLUMNS)
    .order('category', { ascending: true, nullsFirst: false })
    .order('label', { ascending: true });
  if (error) throw toInterestError(error);
  return data;
}

/** The caller's selected interests, oldest first. */
export async function fetchOwnInterests(userId: string): Promise<OwnInterest[]> {
  const { data, error } = await getSupabaseClient()
    .from('profile_interests')
    .select(OWN_INTEREST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw toInterestError(error);
  return data;
}

/**
 * Atomically replaces the caller's selection via the replace_profile_interests RPC (the only
 * write path since Pre-3M: direct table writes are revoked). One transaction, so a failure
 * never leaves a partial selection. Max 8; once onboarding is complete the database also
 * requires at least 3 (`minimum_required`). Returns the selected ids.
 */
export async function replaceOwnInterests(interestIds: readonly string[]): Promise<string[]> {
  const parsed = interestSelectionSchema.safeParse(interestIds);
  if (!parsed.success) {
    throw new InterestError('invalid_input', 'Interest selection is invalid.', {
      cause: parsed.error,
    });
  }
  const { data, error } = await getSupabaseClient().rpc('replace_profile_interests', {
    p_interest_ids: parsed.data,
  });
  if (error) throw toInterestError(error);
  return data.map((row) => row.interest_id);
}
