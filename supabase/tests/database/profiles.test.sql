-- =============================================================================
-- Phase 1M-B · public.profiles security & lifecycle tests (pgTAP)
-- Updated Pre-3M (M-03): under-18 dates of birth are rejected at write, bio is
-- capped at 500, is_discoverable is deprecated (not writable, always false).
-- Onboarding completion / post-onboarding guards: onboarding_model.test.sql.
--
-- Run against the local Supabase stack:   npx supabase test db
-- Run without Docker (plain PostgreSQL):  npm run test:db
--
-- Everything runs inside one transaction and is rolled back.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

-- Fixed test identities --------------------------------------------------------
-- A: main user · B: second user (cross-user checks) · C: deleted user · D: metadata spoof
insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test', '{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.test', '{}'::jsonb),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@example.test', '{}'::jsonb),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd@example.test',
   '{"first_name": "Mallory", "is_profile_complete": true, "is_discoverable": true}'::jsonb);

-- =============================================================================
-- AUTH LIFECYCLE
-- =============================================================================
select is(
  (select count(*)::int from public.profiles
    where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')),
  4,
  'each new auth user gets exactly one profile');

select results_eq(
  $$ select first_name, date_of_birth, gender, is_profile_complete, is_discoverable
       from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (null::text, null::date, null::text, false, false) $$,
  'a new profile starts empty, incomplete and not discoverable');

select results_eq(
  $$ select first_name, is_profile_complete, is_discoverable
       from public.profiles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  $$ values (null::text, false, false) $$,
  'auth user metadata is not trusted or copied into the profile');

select throws_ok(
  $$ insert into public.profiles (id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '23505', null,
  'a second profile row for the same user is impossible');

select throws_ok(
  $$ insert into public.profiles (id) values (gen_random_uuid()) $$,
  '23503', null,
  'a profile cannot exist without an auth user');

delete from auth.users where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  0,
  'deleting the auth user deletes the profile (cascade)');

-- =============================================================================
-- ANON
-- =============================================================================
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok(
  $$ update public.profiles set first_name = 'x' $$, '42501', null, 'anon cannot update profiles');
reset role;

-- =============================================================================
-- AUTHENTICATED AS USER A
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- RLS: reads ------------------------------------------------------------------
select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'A sees only their own profile');
select is_empty(
  $$ select 1 from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'A cannot select B''s profile');

-- RLS: writes -----------------------------------------------------------------
select lives_ok(
  $$ update public.profiles set first_name = '  Asha  ', bio = ' Loves night trains. '
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'A can update editable fields on their own profile');
select results_eq(
  $$ select first_name, bio from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values ('Asha'::text, 'Loves night trains.'::text) $$,
  'text fields are trimmed by the database');
select lives_ok(
  $$ update public.profiles set first_name = 'Hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'an update targeting B runs but RLS matches no rows');
select throws_ok(
  $$ insert into public.profiles (id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', null, 'clients cannot insert profiles');
select throws_ok(
  $$ delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'clients cannot delete profiles');

-- Protected columns -------------------------------------------------------------
select throws_ok(
  $$ update public.profiles set id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'client cannot change profile id');
select throws_ok(
  $$ update public.profiles set is_profile_complete = true
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'client cannot set is_profile_complete');
select throws_ok(
  $$ update public.profiles set created_at = '2000-01-01'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'client cannot set created_at');
select throws_ok(
  $$ update public.profiles set updated_at = '2000-01-01'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'client cannot set updated_at');

-- Completeness ----------------------------------------------------------------
select is(
  (select is_profile_complete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  false, 'first name alone is incomplete');

update public.profiles
   set date_of_birth = (current_date - interval '30 years')::date, gender = 'woman'
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select is_profile_complete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  true, 'first name + adult DOB + gender is complete');

update public.profiles set date_of_birth = (current_date - interval '18 years')::date
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select is_profile_complete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  true, '18th birthday today counts as adult');

select throws_ok(
  $$ update public.profiles
        set date_of_birth = (current_date - interval '18 years' + interval '1 day')::date
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', 'you must be 18 or older', 'a date of birth one day short of 18 is rejected at write');

select throws_ok(
  $$ update public.profiles set date_of_birth = current_date + 1
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', 'date_of_birth cannot be in the future', 'future date of birth is rejected');
select throws_ok(
  $$ update public.profiles set date_of_birth = '1899-12-31'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', null, 'implausible date of birth is rejected');
select throws_ok(
  $$ update public.profiles set gender = 'robot' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', null, 'unknown gender value is rejected');
select throws_ok(
  $$ update public.profiles set first_name = repeat('x', 81)
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', null, 'first_name longer than 80 characters is rejected');
select throws_ok(
  $$ update public.profiles set bio = repeat('x', 501)
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', null, 'bio longer than 500 characters is rejected');

update public.profiles
   set date_of_birth = (current_date - interval '30 years')::date, first_name = '   '
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select results_eq(
  $$ select first_name, is_profile_complete from public.profiles
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (null::text, false) $$,
  'a whitespace-only first name becomes NULL and the profile is incomplete');

update public.profiles set first_name = 'Asha' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select is_profile_complete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  true, 'profile is complete again after restoring first_name');

-- Deprecated discoverability flag + under-18 rejection ----------------------------
select throws_ok(
  $$ update public.profiles set is_discoverable = true where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'deprecated is_discoverable is not writable by clients');
select is(
  (select is_discoverable from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  false, 'is_discoverable stays false for a complete profile');
select throws_ok(
  $$ update public.profiles set date_of_birth = (current_date - interval '17 years')::date
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', 'you must be 18 or older', 'changing the date of birth to under 18 is rejected');
select results_eq(
  $$ select date_of_birth = (current_date - interval '30 years')::date, is_profile_complete
       from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (true, true) $$,
  'a rejected date of birth leaves the profile unchanged');

-- =============================================================================
-- AUTHENTICATED AS USER B (incomplete profile)
-- =============================================================================
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$,
  'B sees only their own profile');
select is(
  (select is_discoverable from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  false, 'discoverable defaults to false');
select throws_ok(
  $$ update public.profiles set is_discoverable = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'an incomplete profile cannot write is_discoverable either');
select lives_ok(
  $$ update public.profiles set bio = 'B was here' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'B''s update of A runs but RLS matches no rows');

-- =============================================================================
-- VERIFY AS DATABASE OWNER (bypasses RLS)
-- =============================================================================
reset role;
set local request.jwt.claims = '';

select results_eq(
  $$ select first_name, bio from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  $$ values (null::text, null::text) $$,
  'B''s profile was not modified by A');
select is(
  (select bio from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Loves night trains.', 'A''s profile was not modified by B');

-- Defence in depth: even privileged writes keep canonical columns consistent.
update public.profiles set created_at = '2000-01-01', updated_at = '2000-01-01'
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select results_eq(
  $$ select created_at <> '2000-01-01'::timestamptz, updated_at = now()
       from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (true, true) $$,
  'created_at and updated_at stay database-controlled even for privileged writes');
select throws_ok(
  $$ update public.profiles set id = gen_random_uuid() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', 'profiles.id cannot be changed', 'profile id is immutable even for privileged writes');
update public.profiles set is_profile_complete = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is(
  (select is_profile_complete from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  false, 'is_profile_complete cannot be forced true even by privileged writes');
update public.profiles set is_discoverable = true where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select is_discoverable from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  false, 'deprecated is_discoverable stays false even for privileged writes');

-- Privilege surface -----------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon has no SELECT privilege on profiles');
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated cannot use the private schema');

select * from finish();
rollback;
