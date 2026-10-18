-- =============================================================================
-- Triply · Pre-3M · M-01 · Canonical interest catalog v1
-- =============================================================================
--
-- The launch interest catalog now ships through migrations, so every
-- environment (local, Dev, staging, production) gets the same rows. Until now
-- the catalog lived only in supabase/seed.sql, which never runs on hosted
-- projects: hosted Dev had an empty catalog (decision pass, finding G).
--
-- Catalog rules (apply to every future catalog_vN migration)
--   * The stable key is the slug. Rows are upserted by slug, so existing rows keep
--     their id (profile_interests reference interests.id) and re-applying is a
--     no-op.
--   * Rows are never deleted: profile_interests has ON DELETE RESTRICT. Retire an
--     interest in a later migration with `active = false`; existing selections
--     remain until the user changes them, and inactive rows cannot be newly
--     selected (profile_interests_before_insert).
--   * Listing a row here declares it active with this label/category.
--   * supabase/seed.sql no longer writes interests.
--
-- v1 = the 14 Phase 1M starter interests (unchanged slugs/labels/categories)
-- plus 16 curated additions. 30 options over the same 5 categories give a real
-- choice for the 3-8 rule without diluting signal. Categories group the picker;
-- order within a category is the client's (alphabetical by label).
--
-- Rollback / recovery (manual only): nothing to drop. To retire a row, ship a
-- new migration that sets active = false for its slug.
-- =============================================================================

insert into public.interests (slug, label, category)
values
  -- outdoors
  ('adventure',      'Adventure',            'outdoors'),
  ('beaches',        'Beaches',              'outdoors'),
  ('camping',        'Camping',              'outdoors'),
  ('diving',         'Diving & snorkelling', 'outdoors'),
  ('hiking',         'Hiking',               'outdoors'),
  ('island-hopping', 'Island hopping',       'outdoors'),
  ('road-trips',     'Road trips',           'outdoors'),
  ('surfing',        'Surfing',              'outdoors'),
  -- wellness
  ('fitness',        'Fitness',              'wellness'),
  ('meditation',     'Meditation',           'wellness'),
  ('running',        'Running',              'wellness'),
  ('wellness',       'Wellness',             'wellness'),
  ('yoga',           'Yoga',                 'wellness'),
  -- culture
  ('art',            'Art',                  'culture'),
  ('books',          'Books',                'culture'),
  ('culture',        'Culture',              'culture'),
  ('film',           'Film',                 'culture'),
  ('history',        'History',              'culture'),
  ('languages',      'Languages',            'culture'),
  ('music',          'Music',                'culture'),
  ('photography',    'Photography',          'culture'),
  -- lifestyle
  ('coffee',         'Coffee',               'lifestyle'),
  ('cooking',        'Cooking',              'lifestyle'),
  ('digital-nomad',  'Digital nomad',        'lifestyle'),
  ('food',           'Food',                 'lifestyle'),
  ('street-food',    'Street food',          'lifestyle'),
  ('wine',           'Wine',                 'lifestyle'),
  -- social
  ('festivals',      'Festivals',            'social'),
  ('nightlife',      'Nightlife',            'social'),
  ('volunteering',   'Volunteering',         'social')
on conflict (slug) do update
  set label    = excluded.label,
      category = excluded.category,
      active   = true;
