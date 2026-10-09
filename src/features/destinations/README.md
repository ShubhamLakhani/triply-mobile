# features/destinations

Read-only destination catalog (`public.destinations`; see `supabase/README.md → Destinations + trips`).

- `api/destination-api.ts`: `fetchActiveDestinations()`, `fetchDestinationBySlug(slug)`, `DESTINATION_COLUMNS`
- `api/destination-keys.ts`: `destinationKeys.list()` / `.detail(slug)`
- `hooks/use-destinations.ts`: `useDestinations()`, `useDestination(slug)` (1-hour stale time)
- `types.ts`: `Destination`, `DestinationSummary` (derived from generated types)

Clients only ever see active destinations. Writes happen through migrations, seed or server tooling.
