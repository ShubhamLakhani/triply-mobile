import type { Tables, TablesUpdate } from '@/services/supabase';

/**
 * Own profile row as read by the app (generated types; never hand-written). The deprecated
 * is_discoverable column is not read (dropped in Phase 4M).
 */
export type Profile = Omit<Tables<'profiles'>, 'is_discoverable'>;

/**
 * Values accepted by the `profiles.gender` CHECK constraint
 * (supabase/migrations/20261009092316_auth_profiles.sql). Keep in sync via migration.
 */
export const GENDERS = ['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Columns the authenticated role may update (column-level GRANT in the migrations).
 * id, created_at, updated_at, is_profile_complete, onboarding_completed_at (complete_onboarding
 * RPC) and discovery_paused_at (set_discovery_paused RPC) are server-controlled. The
 * deprecated is_discoverable is no longer writable. date_of_birth is locked by the database
 * once onboarding is complete.
 */
export const EDITABLE_PROFILE_FIELDS = [
  'first_name',
  'date_of_birth',
  'gender',
  'bio',
  'home_city',
  'home_country',
  'occupation',
] as const satisfies readonly (keyof TablesUpdate<'profiles'>)[];

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

/** Bio limit (profiles_bio_valid CHECK, Pre-3M M-03). */
export const BIO_MAX_LENGTH = 500;
