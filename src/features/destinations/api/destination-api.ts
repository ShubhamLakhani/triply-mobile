import { getSupabaseClient } from '@/services/supabase';

import type { DestinationSummary } from '../types';

/** Explicit column list shared with trip embeds. */
export const DESTINATION_COLUMNS =
  'id, slug, city_name, country_name, country_code, latitude, longitude, timezone, hero_image_url' as const;

export class DestinationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DestinationError';
  }
}

/** Active destinations, alphabetical by city (RLS hides inactive rows). */
export async function fetchActiveDestinations(): Promise<DestinationSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from('destinations')
    .select(DESTINATION_COLUMNS)
    .order('city_name', { ascending: true });
  if (error) throw new DestinationError('Could not load destinations.', { cause: error });
  return data;
}

/** One active destination by its stable slug, or null if unknown/inactive. */
export async function fetchDestinationBySlug(slug: string): Promise<DestinationSummary | null> {
  const { data, error } = await getSupabaseClient()
    .from('destinations')
    .select(DESTINATION_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new DestinationError('Could not load destination.', { cause: error });
  return data;
}
