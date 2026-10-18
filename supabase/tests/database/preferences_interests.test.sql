-- =============================================================================
-- Phase 1M-D · interests + discovery preferences tests (pgTAP)
-- Updated Pre-3M (M-03): selections and gender preferences are RPC-only writes,
-- max 8 interests, max_distance_km deprecated (not writable). Post-onboarding
-- minimums are covered in onboarding_model.test.sql.
--
-- Run against the local Supabase stack:   npx supabase test db
-- Run without Docker (plain PostgreSQL):  npm run test:db
--
-- Self-contained fixtures; everything is rolled back.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(70);

-- Fixtures (as database owner) ------------------------------------------------------
insert into auth.users (id, email)
values
  ('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', 'pref-p@example.test'),
  ('c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2', 'pref-q@example.test');

-- 12 active test interests (…0001 … …0012) and one inactive (…0099).
insert into public.interests (id, slug, label, category, active)
select format('e0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid,
       format('test-int-%s', lpad(n::text, 2, '0')),
       format('Test interest %s', n),
       'testing',
       true
  from generate_series(1, 12) as n;
insert into public.interests (id, slug, label, active)
values ('e0000000-0000-4000-8000-000000000099', 'test-int-inactive', 'Inactive interest', false);

-- =============================================================================
-- CATALOG CONSTRAINTS
-- =============================================================================
select throws_ok(
  $$ insert into public.interests (slug, label) values ('Bad Slug', 'X') $$,
  '23514', null, 'non URL-safe interest slug is rejected');
select throws_ok(
  $$ insert into public.interests (slug, label) values ('blank-label', '  ') $$,
  '23514', null, 'blank / untrimmed interest label is rejected');
select throws_ok(
  $$ insert into public.interests (slug, label, category) values ('bad-category', 'X', 'Out Doors') $$,
  '23514', null, 'malformed category is rejected');
select throws_ok(
  $$ insert into public.interests (slug, label) values ('test-int-01', 'Duplicate') $$,
  '23505', null, 'interest slugs are unique');

-- =============================================================================
-- DEFAULT DISCOVERY PREFERENCES
-- =============================================================================
select is(
  (select count(*)::int from public.profiles p
    where (select count(*) from public.discovery_preferences d where d.user_id = p.id) <> 1),
  0, 'every profile has exactly one discovery_preferences row');
select results_eq(
  $$ select min_age, max_age, minimum_overlap_days, max_distance_km
       from public.discovery_preferences where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  $$ values (18::smallint, 99::smallint, 1::smallint, null::integer) $$,
  'default preferences are 18–99, 1 overlap day, no distance');
select throws_ok(
  $$ insert into public.discovery_preferences (user_id) values ('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1') $$,
  '23505', null, 'a second preferences row for the same user is impossible');

-- =============================================================================
-- ANON
-- =============================================================================
set local role anon;
select throws_ok($$ select * from public.interests $$, '42501', null, 'anon cannot read interests');
select throws_ok($$ select * from public.profile_interests $$, '42501', null, 'anon cannot read selections');
select throws_ok($$ select * from public.discovery_preferences $$, '42501', null, 'anon cannot read preferences');
select throws_ok(
  $$ select * from public.discovery_gender_preferences $$, '42501', null, 'anon cannot read gender preferences');
select throws_ok(
  $$ select public.replace_profile_interests(array[]::uuid[]) $$, '42501', null, 'anon cannot call replace_profile_interests');
select throws_ok(
  $$ select public.set_discovery_gender_preferences(array[]::text[]) $$, '42501', null,
  'anon cannot call set_discovery_gender_preferences');
reset role;

-- =============================================================================
-- AUTHENTICATED AS USER P
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1", "role": "authenticated"}';

-- Catalog ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.interests where slug like 'test-int-%'),
  12, 'authenticated users see active interests only');
select is_empty(
  $$ select 1 from public.interests where id = 'e0000000-0000-4000-8000-000000000099' $$,
  'inactive interest is hidden');
select throws_ok(
  $$ insert into public.interests (slug, label) values ('client-interest', 'X') $$,
  '42501', null, 'clients cannot create interests');
select throws_ok(
  $$ update public.interests set label = 'Hacked' where slug = 'test-int-01' $$,
  '42501', null, 'clients cannot update interests');
select throws_ok(
  $$ delete from public.interests where slug = 'test-int-01' $$,
  '42501', null, 'clients cannot delete interests');

-- Selections (RPC-only since M-03) -------------------------------------------------
select throws_ok(
  $$ insert into public.profile_interests (interest_id) values ('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'P cannot insert selections directly (replace_profile_interests only)');
select throws_ok(
  $$ delete from public.profile_interests $$,
  '42501', null, 'P cannot delete selections directly');
select throws_ok(
  $$ update public.profile_interests set interest_id = 'e0000000-0000-4000-8000-000000000012' $$,
  '42501', null, 'selections cannot be updated in place');
select throws_ok(
  $$ select public.replace_profile_interests(array[gen_random_uuid()]) $$,
  '23503', null, 'an unknown interest cannot be selected');
select is(
  (select count(*)::int from public.replace_profile_interests(array(
     select format('e0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid
       from generate_series(1, 8) as n))),
  8, 'P can select up to 8 interests');
select throws_ok(
  $$ select public.replace_profile_interests(array(
       select format('e0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid
         from generate_series(1, 9) as n)) $$,
  '23514', 'a profile can have at most 8 interests', 'a 9th interest is rejected');
select is((select count(*)::int from public.profile_interests), 8, 'P still has 8 interests');
select lives_ok(
  $$ select public.replace_profile_interests(array(
       select format('e0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid
         from generate_series(2, 9) as n)) $$,
  'swapping one interest at the limit works (replace, not add)');

-- Atomic replacement RPC ----------------------------------------------------------
select is(
  (select count(*)::int from public.replace_profile_interests(array[
     'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
     'e0000000-0000-4000-8000-000000000003']::uuid[])),
  3, 'replace_profile_interests returns the new selection');
select results_eq(
  $$ select interest_id from public.profile_interests order by interest_id $$,
  $$ values ('e0000000-0000-4000-8000-000000000001'::uuid), ('e0000000-0000-4000-8000-000000000002'::uuid),
            ('e0000000-0000-4000-8000-000000000003'::uuid) $$,
  'selection replaced exactly');
select throws_ok(
  $$ select public.replace_profile_interests(array(
       select format('e0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid
         from generate_series(1, 11) as n)) $$,
  '23514', null, 'replacing with 11 interests is rejected');
select throws_ok(
  $$ select public.replace_profile_interests(array[
       'e0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000099']::uuid[]) $$,
  '23503', null, 'replacing with an inactive interest is rejected');
select is(
  (select count(*)::int from public.profile_interests), 3,
  'failed replacements leave the previous selection intact (atomic)');
select throws_ok(
  $$ select public.replace_profile_interests(array['e0000000-0000-4000-8000-000000000004', null]::uuid[]) $$,
  '22023', null, 'null ids are rejected');
select is(
  (select count(*)::int from public.replace_profile_interests(array[
     'e0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000004',
     'e0000000-0000-4000-8000-000000000005']::uuid[])),
  2, 'duplicate ids in the input are collapsed');

-- Discovery preferences -----------------------------------------------------------
select results_eq(
  $$ select user_id from public.discovery_preferences $$,
  $$ values ('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'::uuid) $$,
  'P sees only their own preferences row');
select lives_ok(
  $$ update public.discovery_preferences
        set min_age = 25, max_age = 40, minimum_overlap_days = 3
      where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  'P can update their preferences');
select results_eq(
  $$ select min_age, max_age, minimum_overlap_days, max_distance_km from public.discovery_preferences $$,
  $$ values (25::smallint, 40::smallint, 3::smallint, null::integer) $$,
  'preference update persisted');
select throws_ok(
  $$ update public.discovery_preferences set min_age = 17 $$, '23514', null, 'min_age under 18 is rejected');
select throws_ok(
  $$ update public.discovery_preferences set max_age = 100 $$, '23514', null, 'max_age above 99 is rejected');
select throws_ok(
  $$ update public.discovery_preferences set min_age = 40, max_age = 30 $$,
  '23514', null, 'max_age below min_age is rejected');
select throws_ok(
  $$ update public.discovery_preferences set minimum_overlap_days = 0 $$,
  '23514', null, 'minimum_overlap_days below 1 is rejected');
select throws_ok(
  $$ update public.discovery_preferences set minimum_overlap_days = 61 $$,
  '23514', null, 'minimum_overlap_days above 60 is rejected');
select throws_ok(
  $$ update public.discovery_preferences set max_distance_km = 500 $$,
  '42501', null, 'deprecated max_distance_km is not writable by clients');
select throws_ok(
  $$ update public.discovery_preferences set user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2' $$,
  '42501', null, 'client cannot change preferences owner');
select throws_ok(
  $$ update public.discovery_preferences set created_at = '2000-01-01' $$,
  '42501', null, 'client cannot set created_at');
select throws_ok(
  $$ insert into public.discovery_preferences (user_id) values ('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1') $$,
  '42501', null, 'clients cannot insert preferences rows');
select throws_ok(
  $$ delete from public.discovery_preferences $$, '42501', null, 'clients cannot delete preferences rows');
select lives_ok(
  $$ update public.discovery_preferences set min_age = 50, max_age = 60
      where user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2' $$,
  'an update targeting Q''s preferences runs but RLS matches no rows');

-- Gender preferences (RPC-only since M-03) ------------------------------------------
select throws_ok(
  $$ insert into public.discovery_gender_preferences (gender) values ('woman') $$,
  '42501', null, 'P cannot insert gender preferences directly (set_discovery_gender_preferences only)');
select throws_ok(
  $$ delete from public.discovery_gender_preferences $$,
  '42501', null, 'P cannot delete gender preferences directly');
select is(
  (select count(*)::int from public.set_discovery_gender_preferences(array['woman'])),
  1, 'P can set a gender preference through the RPC');
select is(
  (select count(*)::int from public.set_discovery_gender_preferences(array[]::text[])),
  0, 'before onboarding completes, gender preferences can be cleared (incremental onboarding)');
select is(
  (select count(*)::int from public.set_discovery_gender_preferences(array['man', 'woman', 'non_binary'])),
  3, 'set_discovery_gender_preferences stores a multi-select');
select results_eq(
  $$ select gender from public.set_discovery_gender_preferences(array['woman', 'woman']) $$,
  $$ values ('woman'::text) $$,
  'replacing removes deselected genders and collapses duplicates');
select throws_ok(
  $$ select public.set_discovery_gender_preferences(array['woman', 'robot']) $$,
  '23514', null, 'an invalid value fails the whole replacement');
select results_eq(
  $$ select gender from public.discovery_gender_preferences $$,
  $$ values ('woman'::text) $$,
  'failed replacement leaves previous gender preferences intact (atomic)');

-- =============================================================================
-- AUTHENTICATED AS USER Q
-- =============================================================================
set local request.jwt.claims = '{"sub": "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.profile_interests where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  'Q cannot see P''s interest selections');
select is_empty(
  $$ select 1 from public.discovery_preferences where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  'Q cannot see P''s discovery preferences');
select is_empty(
  $$ select 1 from public.discovery_gender_preferences
      where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  'Q cannot see P''s gender preferences');
select throws_ok(
  $$ delete from public.profile_interests where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  '42501', null, 'Q has no direct delete privilege on anyone''s selections');
select is(
  (select count(*)::int from public.replace_profile_interests(array['e0000000-0000-4000-8000-000000000001']::uuid[])),
  1, 'Q''s replacement only touches Q''s selections');

-- =============================================================================
-- VERIFY AS DATABASE OWNER
-- =============================================================================
reset role;
set local request.jwt.claims = '';

select is(
  (select count(*)::int from public.profile_interests where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'),
  2, 'P''s interests were not modified by Q');
select results_eq(
  $$ select min_age, max_age from public.discovery_preferences
      where user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2' $$,
  $$ values (18::smallint, 99::smallint) $$,
  'Q''s preferences were not modified by P');
select results_eq(
  $$ select gender from public.discovery_gender_preferences
      where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  $$ values ('woman'::text) $$,
  'P''s gender preferences were not modified by Q');
select throws_ok(
  $$ update public.discovery_preferences set user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2'
      where user_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1' $$,
  '42501', 'discovery preferences owner cannot be changed', 'preferences owner is immutable even for privileged writes');
select throws_ok(
  $$ delete from public.interests where id = 'e0000000-0000-4000-8000-000000000004' $$,
  '23503', null, 'an interest in use cannot be deleted from the catalog');

delete from auth.users where id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2';
select is(
  (select count(*)::int from public.discovery_preferences where user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2')
  + (select count(*)::int from public.profile_interests where user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2')
  + (select count(*)::int from public.discovery_gender_preferences where user_id = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2'),
  0, 'deleting the user removes their preferences and selections (cascade)');

-- Privilege surface ---------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.interests', 'insert')
  and not has_table_privilege('authenticated', 'public.interests', 'update')
  and not has_table_privilege('authenticated', 'public.interests', 'delete'),
  'authenticated cannot write the interest catalog');
select ok(
  not has_table_privilege('authenticated', 'public.profile_interests', 'update'),
  'authenticated has no UPDATE on profile_interests');
select ok(
  not has_table_privilege('authenticated', 'public.profile_interests', 'insert')
  and not has_table_privilege('authenticated', 'public.profile_interests', 'delete')
  and not has_table_privilege('authenticated', 'public.discovery_gender_preferences', 'insert')
  and not has_table_privilege('authenticated', 'public.discovery_gender_preferences', 'delete')
  and not has_column_privilege('authenticated', 'public.discovery_preferences', 'max_distance_km', 'update'),
  'authenticated has no direct selection/gender writes and no distance write');
select ok(
  not has_function_privilege('anon', 'public.replace_profile_interests(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.set_discovery_gender_preferences(text[])', 'execute'),
  'anon cannot execute the replacement RPCs');

select * from finish();
rollback;
