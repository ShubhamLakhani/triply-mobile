import type { Tables } from '@/services/supabase';

/** Full catalog row (generated types; never hand-written). */
export type Destination = Tables<'destinations'>;

/** Client-facing destination fields (inactive rows are never visible to clients). */
export type DestinationSummary = Pick<
  Destination,
  | 'id'
  | 'slug'
  | 'city_name'
  | 'country_name'
  | 'country_code'
  | 'latitude'
  | 'longitude'
  | 'timezone'
  | 'hero_image_url'
>;
