-- =============================================================================
-- Phase 1M-C · destinations + trips security & rules tests (pgTAP)
--
-- Run against the local Supabase stack:   npx supabase test db
-- Run without Docker (plain PostgreSQL):  npm run test:db
--
-- Self-contained: creates its own users/destinations; rolled back at the end.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(62);

-- Fixtures (as database owner) -------------------------------------------------
insert into auth.users (id, email)
values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'trip-a@example.test'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'trip-b@example.test');

insert into public.destinations (id, slug, city_name, country_name, country_code, active)
values
  ('d0000000-0000-4000-8000-000000000001', 'test-active-town', 'Active Town', 'Testland', 'TL', true),
  ('d0000000-0000-4000-8000-000000000002', 'test-other-town',  'Other Town',  'Testland', 'TL', true),
  ('d0000000-0000-4000-8000-000000000003', 'test-inactive-town', 'Inactive Town', 'Testland', 'TL', false);

insert into public.trips (id, user_id, destination_id, start_date, end_date)
values
  ('70000000-0000-4000-8000-00000000000a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
   'd0000000-0000-4000-8000-000000000001', current_date + 30, current_date + 37),
  ('70000000-0000-4000-8000-00000000000b', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
   'd0000000-0000-4000-8000-000000000002', current_date + 10, current_date + 14);

-- =============================================================================
-- DESTINATION CONSTRAINTS (catalog writes are privileged)
-- =============================================================================
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code, latitude, longitude)
     values ('lat-test', 'X', 'Y', 'XY', 91, 0) $$,
  '23514', null, 'latitude outside -90..90 is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code, latitude, longitude)
     values ('lon-test', 'X', 'Y', 'XY', 0, -181) $$,
  '23514', null, 'longitude outside -180..180 is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code, latitude)
     values ('pair-test', 'X', 'Y', 'XY', 10) $$,
  '23514', null, 'latitude without longitude is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code)
     values ('cc-lower', 'X', 'Y', 'id') $$,
  '23514', null, 'lowercase country code is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code)
     values ('cc-three', 'X', 'Y', 'IDN') $$,
  '23514', null, 'three-letter country code is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code)
     values ('Bad Slug', 'X', 'Y', 'XY') $$,
  '23514', null, 'non URL-safe slug is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code)
     values ('blank-city', ' ', 'Y', 'XY') $$,
  '23514', null, 'blank / untrimmed city name is rejected');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code)
     values ('test-active-town', 'X', 'Y', 'XY') $$,
  '23505', null, 'destination slugs are unique');

-- =============================================================================
-- ANON
-- =============================================================================
set local role anon;
select throws_ok($$ select * from public.destinations $$, '42501', null, 'anon cannot read destinations');
select throws_ok($$ select * from public.trips $$, '42501', null, 'anon cannot read trips');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000001', current_date, current_date) $$,
  '42501', null, 'anon cannot create trips');
reset role;

-- =============================================================================
-- AUTHENTICATED AS USER A
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1", "role": "authenticated"}';

-- Destination catalog -------------------------------------------------------------
select results_eq(
  $$ select slug from public.destinations where slug like 'test-%' order by slug $$,
  $$ values ('test-active-town'::text), ('test-other-town'::text) $$,
  'authenticated users see active destinations only');
select is_empty(
  $$ select 1 from public.destinations where id = 'd0000000-0000-4000-8000-000000000003' $$,
  'inactive destination is not visible');
select throws_ok(
  $$ insert into public.destinations (slug, city_name, country_name, country_code)
     values ('client-town', 'X', 'Y', 'XY') $$,
  '42501', null, 'clients cannot insert destinations');
select throws_ok(
  $$ update public.destinations set city_name = 'Hacked'
      where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'clients cannot update destinations');
select throws_ok(
  $$ delete from public.destinations where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'clients cannot delete destinations');

-- Trip creation -------------------------------------------------------------------
select lives_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000002', current_date + 60, current_date + 65) $$,
  'A can create a trip (user_id defaults to the caller)');
select results_eq(
  $$ select user_id, status, visibility from public.trips
      where destination_id = 'd0000000-0000-4000-8000-000000000002' $$,
  $$ values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'::uuid, 'planned'::text, 'discoverable'::text) $$,
  'new trip is owned by A, planned and discoverable by default');
select throws_ok(
  $$ insert into public.trips (user_id, destination_id, start_date, end_date)
     values ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'd0000000-0000-4000-8000-000000000001',
             current_date, current_date + 1) $$,
  '42501', null, 'A cannot create a trip for B');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000001', current_date + 5, current_date + 4) $$,
  '23514', null, 'end_date before start_date is rejected');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date, visibility)
     values ('d0000000-0000-4000-8000-000000000001', current_date, current_date, 'public') $$,
  '23514', null, 'unknown visibility is rejected');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values (gen_random_uuid(), current_date, current_date) $$,
  '23503', null, 'unknown destination is rejected');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000003', current_date, current_date) $$,
  '23503', null, 'inactive destination cannot receive new trips');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date, status)
     values ('d0000000-0000-4000-8000-000000000001', current_date, current_date, 'active') $$,
  '42501', null, 'clients cannot choose the initial status');
select throws_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000001', null, current_date) $$,
  '23502', null, 'start_date is required');
select lives_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000001', date '2024-01-01', date '2024-01-05') $$,
  'past trips are allowed');
select lives_ok(
  $$ insert into public.trips (destination_id, start_date, end_date)
     values ('d0000000-0000-4000-8000-000000000001', current_date + 30, current_date + 37) $$,
  'repeat trips to the same destination and dates are allowed');

-- Reads ---------------------------------------------------------------------------
select results_eq(
  $$ select distinct user_id from public.trips $$,
  $$ values ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'::uuid) $$,
  'A only sees their own trips');
select is_empty(
  $$ select 1 from public.trips where id = '70000000-0000-4000-8000-00000000000b' $$,
  'A cannot read B''s trip');

-- Updates -------------------------------------------------------------------------
select lives_ok(
  $$ update public.trips
        set destination_id = 'd0000000-0000-4000-8000-000000000002',
            start_date = current_date + 40, end_date = current_date + 44, visibility = 'hidden'
      where id = '70000000-0000-4000-8000-00000000000a' $$,
  'A can update destination, dates and visibility on their own trip');
select results_eq(
  $$ select destination_id, start_date, end_date, visibility from public.trips
      where id = '70000000-0000-4000-8000-00000000000a' $$,
  $$ values ('d0000000-0000-4000-8000-000000000002'::uuid, current_date + 40, current_date + 44, 'hidden'::text) $$,
  'trip update persisted');
select throws_ok(
  $$ update public.trips set user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
      where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'client cannot reassign trip owner');
select throws_ok(
  $$ update public.trips set id = gen_random_uuid() where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'client cannot change trip id');
select throws_ok(
  $$ update public.trips set created_at = '2000-01-01' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'client cannot set created_at');
select throws_ok(
  $$ update public.trips set updated_at = '2000-01-01' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'client cannot set updated_at');
select throws_ok(
  $$ update public.trips set status = 'active' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', 'clients can only change trip status to cancelled', 'client cannot set status active');
select throws_ok(
  $$ update public.trips set status = 'completed' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'client cannot set status completed');
select throws_ok(
  $$ update public.trips set status = 'unknown' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'client cannot set an unknown status');
select throws_ok(
  $$ update public.trips set end_date = start_date - 1 where id = '70000000-0000-4000-8000-00000000000a' $$,
  '23514', null, 'update cannot make the date range invalid');
select throws_ok(
  $$ update public.trips set destination_id = 'd0000000-0000-4000-8000-000000000003'
      where id = '70000000-0000-4000-8000-00000000000a' $$,
  '23503', null, 'trip cannot be moved to an inactive destination');
select lives_ok(
  $$ update public.trips set start_date = current_date, visibility = 'hidden'
      where id = '70000000-0000-4000-8000-00000000000b' $$,
  'an update targeting B''s trip runs but RLS matches no rows');
select throws_ok(
  $$ delete from public.trips where id = '70000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'clients cannot delete trips (cancel instead)');

-- Cancellation ------------------------------------------------------------------
select lives_ok(
  $$ update public.trips set status = 'cancelled' where id = '70000000-0000-4000-8000-00000000000a' $$,
  'A can cancel their own trip');
select is(
  (select status from public.trips where id = '70000000-0000-4000-8000-00000000000a'),
  'cancelled', 'trip is cancelled');
select lives_ok(
  $$ update public.trips set status = 'cancelled' where id = '70000000-0000-4000-8000-00000000000a' $$,
  'cancelling again is a harmless no-op');
select throws_ok(
  $$ update public.trips set end_date = end_date + 1 where id = '70000000-0000-4000-8000-00000000000a' $$,
  '55000', null, 'a cancelled trip cannot be edited');
select throws_ok(
  $$ update public.trips set status = 'planned' where id = '70000000-0000-4000-8000-00000000000a' $$,
  '55000', null, 'a cancelled trip cannot be reopened');

-- =============================================================================
-- AUTHENTICATED AS USER B
-- =============================================================================
set local request.jwt.claims = '{"sub": "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2", "role": "authenticated"}';

select results_eq(
  $$ select id from public.trips $$,
  $$ values ('70000000-0000-4000-8000-00000000000b'::uuid) $$,
  'B only sees their own trip');
select lives_ok(
  $$ update public.trips set visibility = 'discoverable' where user_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1' $$,
  'an update targeting A''s trips runs but RLS matches no rows');

-- =============================================================================
-- VERIFY AS DATABASE OWNER
-- =============================================================================
reset role;
set local request.jwt.claims = '';

select results_eq(
  $$ select start_date, visibility, status from public.trips
      where id = '70000000-0000-4000-8000-00000000000b' $$,
  $$ values (current_date + 10, 'discoverable'::text, 'planned'::text) $$,
  'B''s trip was not modified by A');
select is(
  (select count(*)::int from public.trips
    where user_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1' and visibility = 'discoverable'
      and id = '70000000-0000-4000-8000-00000000000a'),
  0, 'A''s trips were not modified by B');

-- Privileged paths -----------------------------------------------------------------
select throws_ok(
  $$ update public.trips set user_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
      where id = '70000000-0000-4000-8000-00000000000b' $$,
  '42501', 'trip id and owner cannot be changed', 'owner is immutable even for privileged writes');
select throws_ok(
  $$ update public.trips set status = 'unknown' where id = '70000000-0000-4000-8000-00000000000b' $$,
  '23514', null, 'unknown status is rejected by the CHECK constraint');
select lives_ok(
  $$ update public.trips set status = 'active' where id = '70000000-0000-4000-8000-00000000000b' $$,
  'server-side automation may move a trip to active');
update public.trips set created_at = '2000-01-01', updated_at = '2000-01-01'
 where id = '70000000-0000-4000-8000-00000000000b';
select results_eq(
  $$ select created_at <> '2000-01-01'::timestamptz, updated_at = now()
       from public.trips where id = '70000000-0000-4000-8000-00000000000b' $$,
  $$ values (true, true) $$,
  'timestamps stay database-controlled');

-- Deactivating a destination keeps existing trips but hides the destination.
update public.destinations set active = false where id = 'd0000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub": "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2", "role": "authenticated"}';
select results_eq(
  $$ select t.id, d.id from public.trips t
       left join public.destinations d on d.id = t.destination_id $$,
  $$ values ('70000000-0000-4000-8000-00000000000b'::uuid, null::uuid) $$,
  'existing trip survives deactivation; the inactive destination is hidden from the client');
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ delete from public.destinations where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '23503', null, 'a destination referenced by trips cannot be deleted');

delete from auth.users where id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';
select is(
  (select count(*)::int from public.trips where user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'),
  0, 'deleting the user removes their trips (cascade)');

-- Privilege surface -------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.trips', 'select'), 'anon has no SELECT on trips');
select ok(not has_table_privilege('anon', 'public.destinations', 'select'), 'anon has no SELECT on destinations');
select ok(not has_table_privilege('authenticated', 'public.trips', 'delete'), 'authenticated has no DELETE on trips');
select ok(
  not has_table_privilege('authenticated', 'public.destinations', 'insert')
  and not has_table_privilege('authenticated', 'public.destinations', 'update')
  and not has_table_privilege('authenticated', 'public.destinations', 'delete'),
  'authenticated cannot write the destination catalog');

select * from finish();
rollback;
