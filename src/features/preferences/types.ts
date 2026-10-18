import type { Gender } from '@/features/profile/types';
import type { Tables } from '@/services/supabase';

/**
 * Exactly one row per profile (generated types; never hand-written). The deprecated
 * max_distance_km is not read or written by the app (no location-based matching).
 */
export type DiscoveryPreferences = Omit<Tables<'discovery_preferences'>, 'max_distance_km'>;

export type GenderPreference = Gender;

/** Database bounds (discovery_preferences CHECK constraints). */
export const PREFERENCE_LIMITS = {
  minAge: 18,
  maxAge: 99,
  minOverlapDays: 1,
  maxOverlapDays: 60,
} as const;
