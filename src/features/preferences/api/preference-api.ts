import { getSupabaseClient } from '@/services/supabase';

import {
  discoveryPreferencesUpdateSchema,
  genderPreferencesSchema,
  type DiscoveryPreferencesUpdateInput,
  type GenderPreferencesInput,
} from '../schemas/preferences.schema';
import type { DiscoveryPreferences, GenderPreference } from '../types';

import { PreferenceError, toPreferenceError } from './preference-errors';

export const DISCOVERY_PREFERENCE_COLUMNS =
  'user_id, min_age, max_age, minimum_overlap_days, created_at, updated_at' as const;

/** The caller's preferences row (created automatically with the profile). */
export async function fetchOwnDiscoveryPreferences(userId: string): Promise<DiscoveryPreferences> {
  const { data, error } = await getSupabaseClient()
    .from('discovery_preferences')
    .select(DISCOVERY_PREFERENCE_COLUMNS)
    .eq('user_id', userId)
    .single();
  if (error) throw toPreferenceError(error);
  return data;
}

export async function updateDiscoveryPreferences(
  userId: string,
  input: DiscoveryPreferencesUpdateInput,
): Promise<DiscoveryPreferences> {
  const parsed = discoveryPreferencesUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PreferenceError('invalid_input', 'Preference input is invalid.', {
      cause: parsed.error,
    });
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new PreferenceError('invalid_input', 'No preference fields to update.');
  }
  const { data, error } = await getSupabaseClient()
    .from('discovery_preferences')
    .update(parsed.data)
    .eq('user_id', userId)
    .select(DISCOVERY_PREFERENCE_COLUMNS)
    .single();
  if (error) throw toPreferenceError(error);
  return data;
}

/** Genders the caller wants to meet (empty = not configured yet; "Everyone" = all values). */
export async function fetchOwnGenderPreferences(userId: string): Promise<GenderPreference[]> {
  const { data, error } = await getSupabaseClient()
    .from('discovery_gender_preferences')
    .select('gender')
    .eq('user_id', userId)
    .order('gender', { ascending: true });
  if (error) throw toPreferenceError(error);
  const parsed = genderPreferencesSchema.safeParse(data.map((row) => row.gender));
  if (!parsed.success) {
    throw new PreferenceError('unknown', 'Unexpected gender preference value.', {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * Atomically replaces gender preferences via the set_discovery_gender_preferences RPC (the only
 * write path). Empty is accepted while onboarding is in progress; once onboarding is complete
 * the database rejects it (`gender_required`).
 */
export async function setGenderPreferences(
  values: GenderPreferencesInput,
): Promise<GenderPreference[]> {
  const parsed = genderPreferencesSchema.safeParse(values);
  if (!parsed.success) {
    throw new PreferenceError('invalid_input', 'Gender preferences are invalid.', {
      cause: parsed.error,
    });
  }
  const { data, error } = await getSupabaseClient().rpc('set_discovery_gender_preferences', {
    p_genders: parsed.data,
  });
  if (error) throw toPreferenceError(error);
  return genderPreferencesSchema.parse(data.map((row) => row.gender));
}
