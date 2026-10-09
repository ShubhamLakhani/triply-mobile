-- =============================================================================
-- Phase 1M-E · decisions + matching tests (pgTAP)
--
-- Run against the local Supabase stack:   npx supabase test db
-- Run without Docker (plain PostgreSQL):  npm run test:db
-- Concurrency (simultaneous likes) is exercised separately with two sessions;
-- see supabase/README.md → Decisions + matching.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(54);

-- Fixtures (as database owner) ------------------------------------------------
-- A < B < C < D in UUID order.
insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-00000000000a', 'match-a@example.test'),
  ('20000000-0000-4000-8000-00000000000b', 'match-b@example.test'),
  ('30000000-0000-4000-8000-00000000000c', 'match-c@example.test'),
  ('40000000-0000-4000-8000-00000000000d', 'match-d@example.test');

-- Phase 1M-H: decisions require complete (18+) profiles.
update public.profiles
   set first_name = 'Test', gender = 'woman', date_of_birth = date '1990-01-01'
 where id in ('10000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000c', '40000000-0000-4000-8000-00000000000d');

insert into public.destinations (id, slug, city_name, country_name, country_code)
values ('d1000000-0000-4000-8000-000000000001', 'test-match-town', 'Match Town', 'Testland', 'TL');

insert into public.trips (id, user_id, destination_id, start_date, end_date, status)
values
  ('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a',
   'd1000000-0000-4000-8000-000000000001', current_date + 10, current_date + 15, 'planned'),
  ('b1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b',
   'd1000000-0000-4000-8000-000000000001', current_date + 12, current_date + 18, 'planned'),
  ('b1000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000b',
   'd1000000-0000-4000-8000-000000000001', current_date + 12, current_date + 18, 'cancelled');

-- =============================================================================
-- ANON
-- =============================================================================
set local role anon;
select throws_ok($$ select * from public.user_decisions $$, '42501', null, 'anon cannot read decisions');
select throws_ok($$ select * from public.matches $$, '42501', null, 'anon cannot read matches');
select throws_ok(
  $$ select * from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like') $$,
  '42501', null, 'anon cannot submit decisions');
select throws_ok(
  $$ select * from public.unmatch(gen_random_uuid()) $$, '42501', null, 'anon cannot unmatch');
reset role;

-- =============================================================================
-- USER A: input validation + direct-write protection
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.submit_decision('10000000-0000-4000-8000-00000000000a', 'like') $$,
  '22023', 'cannot make a decision about yourself', 'cannot decide on yourself');
select throws_ok(
  $$ select * from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'superlike') $$,
  '22023', null, 'unknown decision value is rejected');
select throws_ok(
  $$ select * from public.submit_decision(gen_random_uuid(), 'like') $$,
  'P0002', null, 'unknown target user is rejected');
select throws_ok(
  $$ insert into public.user_decisions (actor_user_id, target_user_id, decision)
     values ('10000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b', 'like') $$,
  '42501', null, 'direct decision inserts are blocked');
select throws_ok(
  $$ insert into public.matches (user_low_id, user_high_id)
     values ('10000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'users cannot create matches directly');
select throws_ok(
  $$ select * from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like',
                                          'b1000000-0000-4000-8000-000000000001', null) $$,
  '22023', 'invalid trip context', 'source trip must belong to the actor');
select throws_ok(
  $$ select * from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like',
                                          null, 'a1000000-0000-4000-8000-000000000001') $$,
  '22023', 'invalid trip context', 'target trip must belong to the target');
select throws_ok(
  $$ select * from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like',
                                          null, 'b1000000-0000-4000-8000-000000000002') $$,
  '22023', 'invalid trip context', 'cancelled trips are rejected as context');

-- Decisions -------------------------------------------------------------------------
select results_eq(
  $$ select decision, matched, match_id, match_created
       from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'pass') $$,
  $$ values ('pass'::text, false, null::uuid, false) $$,
  'A can pass on B');
select results_eq(
  $$ select decision, matched, match_id, match_created
       from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like',
                                   'a1000000-0000-4000-8000-000000000001',
                                   'b1000000-0000-4000-8000-000000000001') $$,
  $$ values ('like'::text, false, null::uuid, false) $$,
  'A changes pass → like; a one-sided like creates no match');
select results_eq(
  $$ select actor_user_id, target_user_id, decision, source_trip_id, target_trip_id
       from public.user_decisions $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid, '20000000-0000-4000-8000-00000000000b'::uuid,
             'like'::text, 'a1000000-0000-4000-8000-000000000001'::uuid,
             'b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'one row per pair, actor is the caller, trip context stored');
select results_eq(
  $$ select decision_id from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like') $$,
  $$ select id from public.user_decisions where target_user_id = '20000000-0000-4000-8000-00000000000b' $$,
  'repeat submissions update the same decision row');
select throws_ok(
  $$ update public.user_decisions set decision = 'pass' $$, '42501', null, 'direct decision updates are blocked');
select throws_ok(
  $$ delete from public.user_decisions $$, '42501', null, 'direct decision deletes are blocked');
select is_empty($$ select 1 from public.matches $$, 'no match exists after a one-sided like');

-- =============================================================================
-- USER B: incoming like is invisible; mutual like creates the match
-- =============================================================================
set local request.jwt.claims = '{"sub": "20000000-0000-4000-8000-00000000000b", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.user_decisions where target_user_id = '20000000-0000-4000-8000-00000000000b' $$,
  'B cannot see incoming likes');
select is_empty(
  $$ select 1 from public.user_decisions where actor_user_id = '10000000-0000-4000-8000-00000000000a' $$,
  'B cannot read A''s decisions');
select results_eq(
  $$ select decision, matched, match_id is not null, match_created
       from public.submit_decision('10000000-0000-4000-8000-00000000000a', 'pass') $$,
  $$ values ('pass'::text, false, false, false) $$,
  'B passing on A reveals nothing about A''s like');
select results_eq(
  $$ select decision, matched, match_id is not null, match_created
       from public.submit_decision('10000000-0000-4000-8000-00000000000a', 'like') $$,
  $$ values ('like'::text, true, true, true) $$,
  'B liking A back creates the match');
select results_eq(
  $$ select user_low_id, user_high_id, unmatched_at from public.matches $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid, '20000000-0000-4000-8000-00000000000b'::uuid,
             null::timestamptz) $$,
  'match pair is canonical (low < high) and active');
select results_eq(
  $$ select matched, match_created from public.submit_decision('10000000-0000-4000-8000-00000000000a', 'like') $$,
  $$ values (true, false) $$,
  'a repeated like reports the existing match without creating another');
select is((select count(*)::int from public.matches), 1, 'exactly one match for the pair');
select throws_ok(
  $$ update public.matches set unmatched_at = now() $$, '42501', null, 'direct match updates are blocked');
select throws_ok(
  $$ delete from public.matches $$, '42501', null, 'direct match deletes are blocked');
select is(
  (select count(*)::int from public.user_decisions), 1,
  'B still sees only their own outgoing decision after the match');

-- =============================================================================
-- USER A: sees the match; changing the decision does not unmatch
-- =============================================================================
set local request.jwt.claims = '{"sub": "10000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select is((select count(*)::int from public.matches), 1, 'A sees the match');
select results_eq(
  $$ select matched, match_created from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'pass') $$,
  $$ values (true, false) $$,
  'changing to pass does not silently destroy an active match');
select is(
  (select unmatched_at from public.matches), null::timestamptz, 'match remains active until an explicit unmatch');

-- =============================================================================
-- USER C: non-participant
-- =============================================================================
set local request.jwt.claims = '{"sub": "30000000-0000-4000-8000-00000000000c", "role": "authenticated"}';

select is_empty($$ select 1 from public.matches $$, 'non-participant cannot see the match');
select is_empty($$ select 1 from public.user_decisions $$, 'C cannot see anyone else''s decisions');
reset role;
set local request.jwt.claims = '';
create temporary table match_ab on commit drop as
  select id from public.matches
   where user_low_id = '10000000-0000-4000-8000-00000000000a'
     and user_high_id = '20000000-0000-4000-8000-00000000000b';
grant select on match_ab to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "30000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.unmatch((select id from match_ab)) $$,
  'P0002', 'match not found', 'non-participant gets "not found" for a real match id');

-- =============================================================================
-- UNMATCH (A), idempotency, no rematch
-- =============================================================================
set local request.jwt.claims = '{"sub": "10000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select unmatched_by, unmatched_at is not null from public.unmatch((select id from match_ab)) $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid, true) $$,
  'participant can unmatch; unmatched_by is the caller');
select results_eq(
  $$ select unmatched_by from public.unmatch((select id from match_ab)) $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid) $$,
  'a second unmatch is harmless');
select results_eq(
  $$ select matched, match_id, match_created from public.submit_decision('20000000-0000-4000-8000-00000000000b', 'like') $$,
  $$ values (false, null::uuid, false) $$,
  'liking again after unmatch does not recreate the match');

set local request.jwt.claims = '{"sub": "20000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select results_eq(
  $$ select unmatched_by from public.unmatch((select id from match_ab)) $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid) $$,
  'the other participant unmatching later does not overwrite unmatched_by');
select results_eq(
  $$ select matched, match_id, match_created from public.submit_decision('10000000-0000-4000-8000-00000000000a', 'like') $$,
  $$ values (false, null::uuid, false) $$,
  'reciprocal old likes never reopen an unmatched pair');
select results_eq(
  $$ select id, unmatched_at is not null from public.matches $$,
  $$ select id, true from match_ab $$,
  'participants still see the (unmatched) match row as history');

-- =============================================================================
-- Reverse order: higher-id user likes first (C ↔ D)
-- =============================================================================
set local request.jwt.claims = '{"sub": "40000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select results_eq(
  $$ select matched from public.submit_decision('30000000-0000-4000-8000-00000000000c', 'like') $$,
  $$ values (false) $$, 'D likes C first: no match yet');
set local request.jwt.claims = '{"sub": "30000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select results_eq(
  $$ select matched, match_created from public.submit_decision('40000000-0000-4000-8000-00000000000d', 'like') $$,
  $$ values (true, true) $$, 'C likes D back: match created');
select results_eq(
  $$ select user_low_id, user_high_id from public.matches $$,
  $$ values ('30000000-0000-4000-8000-00000000000c'::uuid, '40000000-0000-4000-8000-00000000000d'::uuid) $$,
  'reverse order still yields the same canonical pair');

-- =============================================================================
-- VERIFY AS DATABASE OWNER (defence in depth)
-- =============================================================================
reset role;
set local request.jwt.claims = '';

select is(
  (select count(*)::int from public.user_decisions), 4, 'exactly one decision row per directed pair');
select throws_ok(
  $$ update public.matches set unmatched_at = null, unmatched_by = null where id = (select id from match_ab) $$,
  '55000', null, 'an unmatched match cannot be reopened even by privileged writes');
select throws_ok(
  $$ update public.matches set user_high_id = '30000000-0000-4000-8000-00000000000c'
      where id = (select id from match_ab) $$,
  '42501', null, 'match participants are immutable');
select throws_ok(
  $$ update public.user_decisions set target_user_id = '30000000-0000-4000-8000-00000000000c'
      where actor_user_id = '10000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'decision pair is immutable');
select throws_ok(
  $$ insert into public.matches (user_low_id, user_high_id)
     values ('40000000-0000-4000-8000-00000000000d', '10000000-0000-4000-8000-00000000000a') $$,
  '23514', null, 'non-canonical pair order is rejected');
select throws_ok(
  $$ insert into public.matches (user_low_id, user_high_id)
     values ('10000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b') $$,
  '23505', null, 'a second match row for the same pair is impossible');
select throws_ok(
  $$ insert into public.user_decisions (actor_user_id, target_user_id, decision)
     values ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'like') $$,
  '23514', null, 'self-decisions are rejected by constraint');

delete from auth.users where id = '20000000-0000-4000-8000-00000000000b';
select is(
  (select count(*)::int from public.user_decisions
    where '20000000-0000-4000-8000-00000000000b' in (actor_user_id, target_user_id))
  + (select count(*)::int from public.matches
    where '20000000-0000-4000-8000-00000000000b' in (user_low_id, user_high_id)),
  0, 'deleting a user removes their decisions and matches (cascade)');

select ok(
  not has_table_privilege('authenticated', 'public.user_decisions', 'insert')
  and not has_table_privilege('authenticated', 'public.user_decisions', 'update')
  and not has_table_privilege('authenticated', 'public.matches', 'insert')
  and not has_table_privilege('authenticated', 'public.matches', 'update'),
  'authenticated has no direct write privileges on decisions or matches');
select ok(
  not has_function_privilege('anon', 'public.submit_decision(uuid, text, uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.unmatch(uuid)', 'execute'),
  'anon cannot execute the decision RPCs');

select * from finish();
rollback;
