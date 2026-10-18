-- =============================================================================
-- Triply · seed.sql
-- =============================================================================
--
-- Development / staging reference data only.
--
-- Where it runs
--   * LOCAL stack: automatically after migrations on `npx supabase start`
--     (first run) and `npx supabase db reset`.
--   * Triply Development (remote): only when explicitly requested with
--     `npx supabase db push --include-seed` while linked to Triply Development.
--   * NEVER production. Production reference data must ship through reviewed
--     migrations or server tooling, not this file.
--
-- Rules
--   * Reference/catalog data only (destinations until the Phase 3M markets
--     migration moves them; interests already ship in migrations). No users,
--     profiles, trips, interest selections, preferences or any personal data
--     (enforced by scripts/check-migrations.mjs).
--   * No schema changes here. Schema belongs in supabase/migrations/.
--   * Idempotent: every statement must be safe to re-run (upsert on a stable
--     natural key such as destinations.slug).
-- =============================================================================

-- Starter destination catalog (Phase 1M-C). Stable slugs; coordinates are city
-- centroids for future map/UX use; hero images are added later.
insert into public.destinations
  (slug, city_name, country_name, country_code, latitude, longitude, timezone)
values
  ('bali',      'Bali',      'Indonesia',            'ID',  -8.409518, 115.188919, 'Asia/Makassar'),
  ('bangkok',   'Bangkok',   'Thailand',             'TH',  13.756331, 100.501765, 'Asia/Bangkok'),
  ('dubai',     'Dubai',     'United Arab Emirates', 'AE',  25.204849,  55.270783, 'Asia/Dubai'),
  ('barcelona', 'Barcelona', 'Spain',                'ES',  41.385064,   2.173404, 'Europe/Madrid'),
  ('paris',     'Paris',     'France',               'FR',  48.856614,   2.352222, 'Europe/Paris'),
  ('lisbon',    'Lisbon',    'Portugal',             'PT',  38.722252,  -9.139337, 'Europe/Lisbon')
on conflict (slug) do update
  set city_name    = excluded.city_name,
      country_name = excluded.country_name,
      country_code = excluded.country_code,
      latitude     = excluded.latitude,
      longitude    = excluded.longitude,
      timezone     = excluded.timezone,
      active       = true;

-- Interests are no longer seeded here: the canonical launch catalog ships through
-- migrations (20261011150000_catalog_interests_v1.sql) to every environment.
