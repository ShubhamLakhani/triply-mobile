-- =============================================================================
-- Phase 1M-H · security + RLS audit tests (pgTAP)
--
-- Cross-cutting invariants over the WHOLE public schema (so a future migration
-- that forgets RLS, a revoke or a search_path fails here), the H-1 fix (only
-- complete/18+ profiles can like or be liked), and an adversarial cross-user
-- matrix (A vs B, nonparticipant C, anon). Per-domain behaviour is tested in the
-- other *.test.sql files.
--
-- Run: npx supabase test db   |   npm run test:db (plain PostgreSQL + shim)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

-- =============================================================================
-- 1. CATALOG INVARIANTS
-- =============================================================================
select is_empty(
  $$ select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has RLS enabled');
select is_empty(
  $$ select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm', 'f') $$,
  'no views / materialized views / foreign tables in public (no RLS bypass surface)');
select is_empty(
  $$ select table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'PUBLIC') $$,
  'anon / PUBLIC have no table privileges in public');
select is_empty(
  $$ select table_name, column_name from information_schema.column_privileges
      where table_schema = 'public' and grantee in ('anon', 'PUBLIC') $$,
  'anon / PUBLIC have no column privileges in public');
select is_empty(
  $$ select table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated'
        and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER') $$,
  'authenticated has no TRUNCATE / REFERENCES / TRIGGER on public tables');
select is(
  (select string_agg(format('%s:%s', table_name, privilege_type), ', '
                     order by table_name::text collate "C", privilege_type::text collate "C")
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  'discovery_gender_preferences:DELETE, profile_interests:DELETE',
  'whole-table write grants for authenticated are exactly the intended inventory');
select is(
  (select string_agg(format('%s:%s(%s)', table_name, privilege_type, cols), ' | '
                     order by table_name::text collate "C", privilege_type::text collate "C")
     from (select table_name, privilege_type,
                  string_agg(column_name, ',' order by column_name::text collate "C") as cols
             from information_schema.column_privileges
            where table_schema = 'public' and grantee = 'authenticated' and privilege_type <> 'SELECT'
            group by 1, 2) g),
  'discovery_gender_preferences:INSERT(gender,user_id) | discovery_preferences:UPDATE(max_age,max_distance_km,min_age,minimum_overlap_days) | profile_interests:INSERT(interest_id,user_id) | profiles:UPDATE(bio,date_of_birth,first_name,gender,home_city,home_country,is_discoverable,occupation) | trips:INSERT(destination_id,end_date,start_date,user_id,visibility) | trips:UPDATE(destination_id,end_date,start_date,status,visibility)',
  'column-level write grants for authenticated are exactly the intended inventory');
select is_empty(
  $$ select tablename, policyname from pg_catalog.pg_policies
      where schemaname = 'public' and roles <> '{authenticated}'::name[] $$,
  'every public policy is scoped to authenticated only (none for anon/public)');
select is_empty(
  $$ select tablename, policyname from pg_catalog.pg_policies
      where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'ALL')
        and (with_check is null or with_check not like '%auth.uid()%') $$,
  'every public INSERT/UPDATE policy has an auth.uid() WITH CHECK');
select is_empty(
  $$ select tablename, policyname from pg_catalog.pg_policies
      where schemaname = 'public' and cmd = 'ALL' $$,
  'no catch-all (FOR ALL) policies');
select is_empty(
  $$ select p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and not exists (select 1 from unnest(p.proconfig) c where c = 'search_path=""') $$,
  'every public/private function pins search_path to empty');
select is_empty(
  $$ select p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and (has_function_privilege('anon', p.oid, 'execute')
             or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                         where a.grantee = 0 and a.privilege_type = 'EXECUTE')) $$,
  'no function in public/private is executable by anon or PUBLIC');
select is_empty(
  $$ select p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute') $$,
  'authenticated cannot execute any private helper');
select is_empty(
  $$ select p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prosrc not like '%auth.uid()%' $$,
  'every public SECURITY DEFINER function derives identity from auth.uid()');
select is_empty(
  $$ select p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosrc ~* '\mexecute\M\s' $$,
  'no dynamic SQL (EXECUTE) in app functions');
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
  and not has_schema_privilege('anon', 'private', 'usage'),
  'private schema is not usable by API roles');
select is_empty(
  $$ select policyname from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and (roles <> '{authenticated}'::name[]
             or coalesce(qual, '') || coalesce(with_check, '') not like '%bucket_id = ''profile-photos''%') $$,
  'storage policies are authenticated-only and scoped to the profile-photos bucket');
select is_empty(
  $$ select id from storage.buckets where public $$,
  'no public storage buckets');

-- Fixtures (as database owner) ------------------------------------------------
insert into auth.users (id, email)
values
  ('1d000000-0000-4000-8000-00000000000a', 'audit-a@example.test'),
  ('2d000000-0000-4000-8000-00000000000b', 'audit-b@example.test'),
  ('3d000000-0000-4000-8000-00000000000c', 'audit-c@example.test'),
  ('4d000000-0000-4000-8000-00000000000d', 'audit-minor@example.test'),
  ('5d000000-0000-4000-8000-00000000000e', 'audit-incomplete@example.test');
update public.profiles
   set first_name = 'Audit', gender = 'woman', date_of_birth = date '1990-01-01'
 where id in ('1d000000-0000-4000-8000-00000000000a', '2d000000-0000-4000-8000-00000000000b',
              '3d000000-0000-4000-8000-00000000000c');
update public.profiles
   set first_name = 'Minor', gender = 'man', date_of_birth = current_date - interval '15 years'
 where id = '4d000000-0000-4000-8000-00000000000d';
insert into public.destinations (id, slug, city_name, country_name, country_code)
values ('d3000000-0000-4000-8000-000000000001', 'test-audit-town', 'Audit Town', 'Testland', 'TL');
insert into public.trips (id, user_id, destination_id, start_date, end_date)
values ('b3000000-0000-4000-8000-000000000001', '2d000000-0000-4000-8000-00000000000b',
        'd3000000-0000-4000-8000-000000000001', current_date + 5, current_date + 9);
insert into public.interests (id, slug, label)
values ('e3000000-0000-4000-8000-000000000001', 'audit-interest', 'Audit interest');
insert into public.profile_interests (user_id, interest_id)
values ('2d000000-0000-4000-8000-00000000000b', 'e3000000-0000-4000-8000-000000000001');
insert into public.discovery_gender_preferences (user_id, gender)
values ('2d000000-0000-4000-8000-00000000000b', 'man');
insert into public.user_blocks (blocker_user_id, blocked_user_id)
values ('2d000000-0000-4000-8000-00000000000b', '3d000000-0000-4000-8000-00000000000c');
insert into public.user_reports (reporter_user_id, reported_user_id, reason)
values ('2d000000-0000-4000-8000-00000000000b', '1d000000-0000-4000-8000-00000000000a', 'spam');

-- =============================================================================
-- 2. H-1: ONLY COMPLETE (18+) PROFILES CAN LIKE OR BE LIKED
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "4d000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.submit_decision('1d000000-0000-4000-8000-00000000000a', 'like') $$,
  '42501', 'complete your profile first', 'an under-18 account cannot like anyone');
select lives_ok(
  $$ select * from public.block_user('1d000000-0000-4000-8000-00000000000a') $$,
  'an under-18 account can still block (safety tools stay open)');
select lives_ok(
  $$ select * from public.report_user('1d000000-0000-4000-8000-00000000000a', 'safety_concern') $$,
  'an under-18 account can still report');
select is(public.unblock_user('1d000000-0000-4000-8000-00000000000a'), true, 'and unblock');

set local request.jwt.claims = '{"sub": "1d000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.submit_decision('4d000000-0000-4000-8000-00000000000d', 'like') $$,
  '42501', 'interaction unavailable', 'an adult cannot like an under-18 profile (generic error)');
select throws_ok(
  $$ select * from public.submit_decision('5d000000-0000-4000-8000-00000000000e', 'pass') $$,
  '42501', 'interaction unavailable', 'an incomplete profile cannot be liked or passed');
select is_empty($$ select 1 from public.user_decisions $$, 'rejected decisions wrote nothing');

-- =============================================================================
-- 3. ADVERSARIAL MATRIX: A (attacker) vs B (victim)
-- =============================================================================
select results_eq(
  $$ select (select count(*) from public.profiles where id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.trips where user_id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.discovery_preferences where user_id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.discovery_gender_preferences where user_id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.profile_interests where user_id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.user_decisions where actor_user_id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.user_blocks where blocker_user_id = '2d000000-0000-4000-8000-00000000000b')
          + (select count(*) from public.profile_photos where user_id = '2d000000-0000-4000-8000-00000000000b') $$,
  $$ values (0::bigint) $$,
  'A can read none of B''s rows in any user-owned table');
select is_empty(
  $$ select 1 from public.user_reports $$,
  'A cannot see the report B filed against A');
select is_empty(
  $$ with u as (update public.profiles set bio = 'pwned' where id = '2d000000-0000-4000-8000-00000000000b' returning 1)
     select * from u $$,
  'A''s UPDATE of B''s profile matches no rows');
select is_empty(
  $$ with u as (update public.trips set visibility = 'hidden' where user_id = '2d000000-0000-4000-8000-00000000000b' returning 1)
     select * from u $$,
  'A''s UPDATE of B''s trip matches no rows');
select is_empty(
  $$ with u as (update public.discovery_preferences set min_age = 50 where user_id = '2d000000-0000-4000-8000-00000000000b' returning 1)
     select * from u $$,
  'A''s UPDATE of B''s preferences matches no rows');
select is_empty(
  $$ with d as (delete from public.profile_interests where user_id = '2d000000-0000-4000-8000-00000000000b' returning 1)
     select * from d $$,
  'A''s DELETE of B''s interests matches no rows');
select is_empty(
  $$ with d as (delete from public.discovery_gender_preferences where user_id = '2d000000-0000-4000-8000-00000000000b' returning 1)
     select * from d $$,
  'A''s DELETE of B''s gender preferences matches no rows');
select throws_ok(
  $$ insert into public.trips (user_id, destination_id, start_date, end_date)
     values ('2d000000-0000-4000-8000-00000000000b', 'd3000000-0000-4000-8000-000000000001', current_date + 1, current_date + 2) $$,
  '42501', null, 'A cannot insert a trip owned by B');
select throws_ok(
  $$ insert into public.profile_interests (user_id, interest_id)
     values ('2d000000-0000-4000-8000-00000000000b', 'e3000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'A cannot add interests for B');
select throws_ok(
  $$ insert into public.discovery_gender_preferences (user_id, gender)
     values ('2d000000-0000-4000-8000-00000000000b', 'woman') $$,
  '42501', null, 'A cannot add gender preferences for B');
select throws_ok(
  $$ select private.is_adult(date '2000-01-01', current_date) $$,
  '42501', null, 'A cannot call private helpers');
select lives_ok(
  $$ select * from public.submit_decision('2d000000-0000-4000-8000-00000000000b', 'like') $$,
  'A likes B');

-- B: incoming like invisible; mutual like creates the match --------------------
set local request.jwt.claims = '{"sub": "2d000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.user_decisions where target_user_id = '2d000000-0000-4000-8000-00000000000b' $$,
  'B cannot see A''s incoming like before matching');
select results_eq(
  $$ select matched, match_created from public.submit_decision('1d000000-0000-4000-8000-00000000000a', 'like') $$,
  $$ values (true, true) $$,
  'mutual like between complete adults matches');

-- C: nonparticipant ------------------------------------------------------------
set local request.jwt.claims = '{"sub": "3d000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select is_empty($$ select 1 from public.matches $$, 'C cannot see the A–B match');
select is_empty($$ select 1 from public.user_blocks $$, 'C cannot see that B blocked C');
select throws_ok(
  $$ select * from public.submit_decision('2d000000-0000-4000-8000-00000000000b', 'like') $$,
  '42501', 'interaction unavailable', 'C (blocked by B) gets the generic error, not "you are blocked"');
reset role;
set local request.jwt.claims = '';
create temporary table audit_match on commit drop as select id from public.matches;
grant select on audit_match to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "3d000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.unmatch((select id from audit_match)) $$,
  'P0002', 'match not found', 'C cannot unmatch A–B');
select throws_ok(
  $$ select * from public.report_user('1d000000-0000-4000-8000-00000000000a', 'spam', null, (select id from audit_match)) $$,
  '22023', 'invalid report context', 'C cannot attach the A–B match to a report');

-- anon --------------------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
set local role anon;
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok(
  $$ select * from public.submit_decision('2d000000-0000-4000-8000-00000000000b', 'like') $$,
  '42501', null, 'anon cannot call submit_decision');
reset role;

select * from finish();
rollback;
