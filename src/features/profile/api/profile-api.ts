import { getSupabaseClient } from '@/services/supabase';

import { profileUpdateSchema, type ProfileUpdateInput } from '../schemas/profile.schema';
import type { Profile } from '../types';

import { ProfileError, toProfileError } from './profile-errors';

/** Explicit column list: never `select *`, so new columns are opted in deliberately. */
export const PROFILE_COLUMNS =
  'id, first_name, date_of_birth, gender, bio, home_city, home_country, occupation, is_profile_complete, is_discoverable, created_at, updated_at';

/** Reads the signed-in user's own profile (RLS only exposes the caller's row). */
export async function fetchOwnProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw toProfileError(error);
  return data;
}

/**
 * Updates editable fields on the caller's own profile and returns the canonical row
 * (including database-computed is_profile_complete / normalised is_discoverable).
 */
export async function updateOwnProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<Profile> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProfileError('invalid_input', 'Profile input is invalid.', { cause: parsed.error });
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new ProfileError('invalid_input', 'No profile fields to update.');
  }

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(parsed.data)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw toProfileError(error);
  return data;
}
