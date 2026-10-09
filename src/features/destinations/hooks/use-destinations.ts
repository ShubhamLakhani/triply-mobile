import { useQuery } from '@tanstack/react-query';

import { fetchActiveDestinations, fetchDestinationBySlug } from '../api/destination-api';
import { destinationKeys } from '../api/destination-keys';

/** The catalog changes rarely; keep it fresh for an hour. */
const CATALOG_STALE_TIME = 60 * 60 * 1000;

/** Active destination catalog. Requires a signed-in user (anon has no access). */
export function useDestinations(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: destinationKeys.list(),
    queryFn: fetchActiveDestinations,
    staleTime: CATALOG_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

export function useDestination(slug: string | null) {
  return useQuery({
    queryKey: destinationKeys.detail(slug ?? ''),
    queryFn: () => fetchDestinationBySlug(slug ?? ''),
    staleTime: CATALOG_STALE_TIME,
    enabled: slug !== null && slug !== '',
  });
}
