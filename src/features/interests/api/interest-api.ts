import { getSupabaseClient } from '@/services/supabase';

import { interestIdSchema, interestSelectionSchema } from '../schemas/interest.schema';
import type { InterestSummary, OwnInterest } from '../types';

import { InterestError, toInterestError } from './interest-errors';

export const INTEREST_COLUMNS = 'id, slug, label, category' as const;
export const OWN_INTEREST_SELECT =
  `interest_id, created_at, interest:interests(${INTEREST_COLUMNS})` as const;

function parseInterestId(interestId: string): string {
  const parsed = interestIdSchema.safeParse(interestId);
  if (!parsed.success) {
    throw new InterestError('invalid_input', 'Interest id is invalid.', { cause: parsed.error });
  }
  return parsed.data;
}

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

/** Adds one interest (database enforces active interests and the 10-interest limit). */
export async function addInterest(userId: string, interestId: string): Promise<void> {
  const id = parseInterestId(interestId);
  const { error } = await getSupabaseClient()
    .from('profile_interests')
    .insert({ user_id: userId, interest_id: id });
  if (error) throw toInterestError(error);
}

export async function removeInterest(userId: string, interestId: string): Promise<void> {
  const id = parseInterestId(interestId);
  const { error } = await getSupabaseClient()
    .from('profile_interests')
    .delete()
    .eq('user_id', userId)
    .eq('interest_id', id);
  if (error) throw toInterestError(error);
}

/**
 * Atomically replaces the caller's selection via the replace_profile_interests RPC
 * (one transaction: a failure never leaves a partial selection). Returns the selected ids.
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
