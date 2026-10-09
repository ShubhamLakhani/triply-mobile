-- =============================================================================
-- Triply · Phase 1M-C · Destinations + trips
-- =============================================================================
--
-- Triply is trip-centric: "I am going to Bali from 4 to 12 Dec", never live
-- location. This migration adds:
--
--   public.destinations  read-mostly catalog (city-level). Written only by
--                        migrations / seed / server tooling (service_role).
--   public.trips         a user's planned trip to one destination for a date
--                        range. Owner-only access in this phase.
--
-- Destination rules
--   * slug: lowercase URL-safe (`bali`, `buenos-aires`), unique, 2–80 chars.
--   * city_name / country_name: trimmed, 1–120 chars.
--   * country_code: ISO 3166-1 alpha-2 style, exactly two uppercase letters.
--   * latitude / longitude: optional, within range, both or neither (city
--     centroid for future map/UX use — never user location).
--   * timezone: optional IANA-style name; hero_image_url: optional https URL.
--   * Clients (authenticated) can SELECT active destinations only. anon: none.
--
-- Trip rules
--   * end_date >= start_date. Both required. Past trips are ALLOWED (history
--     can matter later); future discovery filters to upcoming/active trips.
--     Sanity bounds only: start_date >= 2000-01-01, end_date <= 2100-12-31.
--     No maximum trip length, no one-trip-per-destination rule.
--   * status: planned | active | completed | cancelled (default planned).
--       - Clients may only move a trip to `cancelled`. `active` / `completed`
--         are reserved for future server-side automation.
--       - `cancelled` is terminal: a cancelled trip cannot be edited or
--         reopened (create a new trip instead). History is preserved.
--   * visibility: discoverable | hidden (default discoverable), owner-controlled.
--   * Cancel instead of delete: there is NO client DELETE (no policy, no grant).
--     Trips are removed only when the owning profile/auth user is deleted
--     (on delete cascade).
--   * A trip can only be created for, or moved to, an ACTIVE destination
--     visible to the caller. Existing trips keep their destination if it is
--     later deactivated.
--   * Protected columns: id, user_id, created_at, updated_at (no column grant
--     + trigger enforcement). user_id defaults to auth.uid(); RLS requires it.
--
-- Future discovery eligibility (NOT implemented here; for the discovery RPC):
--   trip.visibility = 'discoverable' AND trip.status IN ('planned','active')
--   AND trip.end_date >= current_date AND owner profile is_discoverable AND
--   owner is still an adult. Hidden and cancelled trips are never eligible.
--   Discovery must go through a SECURITY DEFINER RPC / view that returns only
--   discovery-safe fields; these tables must not get broad SELECT policies.
--
-- Indexes
--   trips_user_id_start_date_idx  owner's trip list ordered by date; also
--                                 serves the user_id FK cascade.
--   trips_destination_id_idx      destination FK (restrict checks, admin).
--   trips_discovery_idx           partial (destination_id, start_date,
--                                 end_date) for future "same place, overlapping
--                                 dates" lookups over eligible trips only.
--   Separate status / visibility indexes are deliberately omitted (low
--   cardinality; covered by the partial index predicate).
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   drop table if exists public.trips;
--   drop function if exists private.trips_before_write();
--   drop table if exists public.destinations;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.destinations
-- -----------------------------------------------------------------------------

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  city_name text not null,
  country_name text not null,
  country_code text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text,
  hero_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint destinations_slug_key unique (slug),
  constraint destinations_slug_format
    check (char_length(slug) between 2 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint destinations_city_name_valid
    check (char_length(city_name) between 1 and 120 and city_name = btrim(city_name)),
  constraint destinations_country_name_valid
    check (char_length(country_name) between 1 and 120 and country_name = btrim(country_name)),
  constraint destinations_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),
  constraint destinations_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint destinations_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint destinations_coordinates_paired
    check ((latitude is null) = (longitude is null)),
  constraint destinations_timezone_format
    check (timezone is null or (char_length(timezone) between 1 and 64
           and timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$')),
  constraint destinations_hero_image_url_format
    check (hero_image_url is null or (char_length(hero_image_url) <= 2048
           and hero_image_url ~ '^https://'))
);

comment on table public.destinations is
  'City-level destination catalog. Read-only for clients (active rows only); written by migrations/seed/server tooling.';
comment on column public.destinations.country_code is 'ISO 3166-1 alpha-2, uppercase.';
comment on column public.destinations.latitude is 'Destination centroid (not user location). Paired with longitude.';
comment on column public.destinations.active is 'Inactive destinations are hidden from clients and cannot receive new trips.';

create trigger set_updated_at
  before update on public.destinations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- public.trips
-- -----------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  destination_id uuid not null
    references public.destinations (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned',
  visibility text not null default 'discoverable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trips_date_range_valid check (end_date >= start_date),
  constraint trips_dates_plausible
    check (start_date >= date '2000-01-01' and end_date <= date '2100-12-31'),
  constraint trips_status_valid
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  constraint trips_visibility_valid
    check (visibility in ('discoverable', 'hidden'))
);

comment on table public.trips is
  'A user''s trip to one destination for a date range. Owner-only access; cancel instead of delete.';
comment on column public.trips.status is
  'planned | active | completed | cancelled. Clients may only set cancelled (terminal); active/completed reserved for server automation.';
comment on column public.trips.visibility is
  'discoverable | hidden. Hidden and cancelled trips are never eligible for discovery.';

create index trips_user_id_start_date_idx on public.trips (user_id, start_date);
create index trips_destination_id_idx on public.trips (destination_id);
create index trips_discovery_idx on public.trips (destination_id, start_date, end_date)
  where visibility = 'discoverable' and status in ('planned', 'active');

-- -----------------------------------------------------------------------------
-- Trip write rules
-- -----------------------------------------------------------------------------

-- SECURITY INVOKER on purpose: current_user identifies client writes, and the
-- destination lookup runs under the caller's RLS (clients only see active
-- destinations, so inactive/unknown destinations are rejected for them).
create or replace function private.trips_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception 'trip id and owner cannot be changed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;

    if old.status = 'cancelled' then
      if row(new.destination_id, new.start_date, new.end_date, new.status, new.visibility)
         is distinct from
         row(old.destination_id, old.start_date, old.end_date, old.status, old.visibility) then
        raise exception 'cancelled trips cannot be changed' using errcode = '55000';
      end if;
    elsif new.status is distinct from old.status
          and v_is_client and new.status <> 'cancelled' then
      raise exception 'clients can only change trip status to cancelled' using errcode = '42501';
    end if;
  else
    new.created_at := now();
    new.updated_at := now();
    if v_is_client and new.status <> 'planned' then
      raise exception 'new trips must start as planned' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' or new.destination_id is distinct from old.destination_id then
    if not exists (
      select 1 from public.destinations d
       where d.id = new.destination_id and d.active
    ) then
      raise exception 'destination is not available' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

comment on function private.trips_before_write() is
  'BEFORE INSERT/UPDATE on public.trips: protects id/owner/created_at, enforces client status rules, terminal cancellation and active destinations.';

revoke all on function private.trips_before_write() from public, anon, authenticated;

create trigger trips_before_write
  before insert or update on public.trips
  for each row execute function private.trips_before_write();

create trigger set_updated_at
  before update on public.trips
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on table public.destinations from public, anon, authenticated;
grant select on table public.destinations to authenticated;
grant all on table public.destinations to service_role;

revoke all on table public.trips from public, anon, authenticated;
grant select on table public.trips to authenticated;
grant insert (user_id, destination_id, start_date, end_date, visibility)
  on table public.trips to authenticated;
grant update (destination_id, start_date, end_date, status, visibility)
  on table public.trips to authenticated;
grant all on table public.trips to service_role;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.destinations enable row level security;
alter table public.trips enable row level security;

create policy "destinations_select_active"
  on public.destinations
  for select
  to authenticated
  using (active);

create policy "trips_select_own"
  on public.trips
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "trips_insert_own"
  on public.trips
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "trips_update_own"
  on public.trips
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Intentionally no DELETE policies and no client write policies on destinations.
