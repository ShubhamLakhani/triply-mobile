import type { Tables, TablesUpdate } from '@/services/supabase';

/** Own profile row as returned by the database (generated types; never hand-written). */
export type Profile = Tables<'profiles'>;

/**
 * Values accepted by the `profiles.gender` CHECK constraint
 * (supabase/migrations/20261009092316_auth_profiles.sql). Keep in sync via migration.
 */
export const GENDERS = ['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Columns the authenticated role may update (column-level GRANT in the migration).
 * id, created_at, updated_at and is_profile_complete are database-controlled.
 */
export const EDITABLE_PROFILE_FIELDS = [
  'first_name',
  'date_of_birth',
  'gender',
  'bio',
  'home_city',
  'home_country',
  'occupation',
  'is_discoverable',
] as const satisfies readonly (keyof TablesUpdate<'profiles'>)[];

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];
