import type { Gender } from '@/features/profile/types';
import type { Tables } from '@/services/supabase';

/** Exactly one row per profile (generated types; never hand-written). */
export type DiscoveryPreferences = Tables<'discovery_preferences'>;

export type GenderPreference = Gender;

/** Database bounds (discovery_preferences CHECK constraints). */
export const PREFERENCE_LIMITS = {
  minAge: 18,
  maxAge: 99,
  minOverlapDays: 1,
  maxOverlapDays: 60,
  maxDistanceKm: 20000,
} as const;
