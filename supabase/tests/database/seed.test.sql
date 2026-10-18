-- =============================================================================
-- Seed catalog tests (pgTAP): starter destinations. Expects supabase/seed.sql
-- to have been applied (local stack: `supabase db reset`; the plain-Postgres
-- harness applies it twice to prove idempotency). Interests ship through
-- migrations since Pre-3M M-01 (see catalog_interests.test.sql).
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

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

select * from finish();
rollback;
