-- =============================================================================
-- Seed catalog tests (pgTAP): destinations + interests. Expects supabase/seed.sql
-- to have been applied (local stack: `supabase db reset`; the plain-Postgres
-- harness applies it twice to prove idempotency).
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select results_eq(
  $$ select slug, count(*)::int from public.destinations
      where slug in ('bali', 'bangkok', 'dubai', 'barcelona', 'paris', 'lisbon')
      group by slug order by slug $$,
  $$ values ('bali'::text, 1), ('bangkok', 1), ('barcelona', 1), ('dubai', 1), ('lisbon', 1), ('paris', 1) $$,
  'each starter destination exists exactly once');

select is(
  (select count(*)::int from public.destinations
    where slug in ('bali', 'bangkok', 'dubai', 'barcelona', 'paris', 'lisbon') and active),
  6, 'starter destinations are active');

select results_eq(
  $$ select country_code from public.destinations
      where slug in ('bali', 'bangkok', 'dubai', 'barcelona', 'paris', 'lisbon') order by slug $$,
  $$ values ('ID'::text), ('TH'), ('ES'), ('AE'), ('PT'), ('FR') $$,
  'starter destinations carry ISO country codes');

select results_eq(
  $$ select slug, count(*)::int from public.interests
      where slug in ('hiking', 'photography', 'food', 'coffee', 'beaches', 'surfing', 'nightlife',
                     'fitness', 'art', 'music', 'adventure', 'culture', 'wellness', 'digital-nomad')
      group by slug order by slug $$,
  $$ values ('adventure'::text, 1), ('art', 1), ('beaches', 1), ('coffee', 1), ('culture', 1),
            ('digital-nomad', 1), ('fitness', 1), ('food', 1), ('hiking', 1), ('music', 1),
            ('nightlife', 1), ('photography', 1), ('surfing', 1), ('wellness', 1) $$,
  'each starter interest exists exactly once');

select is(
  (select count(*)::int from public.interests
    where slug in ('hiking', 'photography', 'food', 'coffee', 'beaches', 'surfing', 'nightlife',
                   'fitness', 'art', 'music', 'adventure', 'culture', 'wellness', 'digital-nomad')
      and active and category is not null),
  14, 'starter interests are active and categorised');

select is(
  (select label from public.interests where slug = 'digital-nomad'),
  'Digital nomad', 'interest labels are user-friendly');

select * from finish();
rollback;
