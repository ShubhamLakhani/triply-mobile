-- =============================================================================
-- Phase 1M-F · blocking + reporting tests (pgTAP)
--
-- Run against the local Supabase stack:   npx supabase test db
-- Run without Docker (plain PostgreSQL):  npm run test:db
-- Block-vs-like concurrency is exercised separately with parallel sessions;
-- see supabase/README.md → Blocking + reporting.
--
-- Users (UUID order A < B < C < D < E):
--   A, B  matched, then A blocks B            (block terminates active match)
--   C, D  matched, C unmatched, then D blocks C (terminal state untouched)
--   D, E  stale reciprocal likes, then D blocks E (no rematch while blocked)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(85);

-- Fixtures (as database owner) ------------------------------------------------
insert into auth.users (id, email)
values
  ('1f000000-0000-4000-8000-00000000000a', 'safety-a@example.test'),
  ('2f000000-0000-4000-8000-00000000000b', 'safety-b@example.test'),
  ('3f000000-0000-4000-8000-00000000000c', 'safety-c@example.test'),
  ('4f000000-0000-4000-8000-00000000000d', 'safety-d@example.test'),
  ('5f000000-0000-4000-8000-00000000000e', 'safety-e@example.test');

-- Phase 1M-H: decisions require complete (18+) profiles.
update public.profiles
   set first_name = 'Test', gender = 'woman', date_of_birth = date '1990-01-01'
 where id in ('1f000000-0000-4000-8000-00000000000a', '2f000000-0000-4000-8000-00000000000b', '3f000000-0000-4000-8000-00000000000c', '4f000000-0000-4000-8000-00000000000d', '5f000000-0000-4000-8000-00000000000e');

insert into public.destinations (id, slug, city_name, country_name, country_code)
values ('d2000000-0000-4000-8000-000000000001', 'test-safety-town', 'Safety Town', 'Testland', 'TL');

insert into public.trips (id, user_id, destination_id, start_date, end_date, status)
values
  ('a2000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-00000000000a',
   'd2000000-0000-4000-8000-000000000001', current_date + 10, current_date + 15, 'planned'),
  ('b2000000-0000-4000-8000-000000000001', '2f000000-0000-4000-8000-00000000000b',
   'd2000000-0000-4000-8000-000000000001', current_date + 12, current_date + 18, 'cancelled'),
  ('c2000000-0000-4000-8000-000000000001', '3f000000-0000-4000-8000-00000000000c',
   'd2000000-0000-4000-8000-000000000001', current_date + 12, current_date + 18, 'planned');

-- Stale reciprocal likes D ↔ E with no match row (only possible as owner).
insert into public.user_decisions (actor_user_id, target_user_id, decision)
values
  ('4f000000-0000-4000-8000-00000000000d', '5f000000-0000-4000-8000-00000000000e', 'like'),
  ('5f000000-0000-4000-8000-00000000000e', '4f000000-0000-4000-8000-00000000000d', 'like');

-- Matches A–B (active) and C–D (C unmatches) through the real RPCs.
set local role authenticated;
set local request.jwt.claims = '{"sub": "1f000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select * from public.submit_decision('2f000000-0000-4000-8000-00000000000b', 'like');
set local request.jwt.claims = '{"sub": "2f000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select * from public.submit_decision('1f000000-0000-4000-8000-00000000000a', 'like');
set local request.jwt.claims = '{"sub": "3f000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select * from public.submit_decision('4f000000-0000-4000-8000-00000000000d', 'like');
set local request.jwt.claims = '{"sub": "4f000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select * from public.submit_decision('3f000000-0000-4000-8000-00000000000c', 'like');
set local request.jwt.claims = '{"sub": "3f000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select * from public.unmatch((select id from public.matches));
reset role;
set local request.jwt.claims = '';

create temporary table fx on commit drop as
  select
    (select id from public.matches
      where user_low_id = '1f000000-0000-4000-8000-00000000000a'
        and user_high_id = '2f000000-0000-4000-8000-00000000000b') as match_ab,
    (select id from public.matches
      where user_low_id = '3f000000-0000-4000-8000-00000000000c'
        and user_high_id = '4f000000-0000-4000-8000-00000000000d') as match_cd;
grant select on fx to authenticated;

select ok(
  (select match_ab is not null and match_cd is not null from fx),
  'fixture: A–B active match and C–D unmatched match exist');

-- =============================================================================
-- ANON
-- =============================================================================
set local role anon;
select throws_ok($$ select * from public.user_blocks $$, '42501', null, 'anon cannot read blocks');
select throws_ok($$ select id from public.user_reports $$, '42501', null, 'anon cannot read reports');
select throws_ok(
  $$ select * from public.block_user('2f000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'anon cannot block');
select throws_ok(
  $$ select public.unblock_user('2f000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'anon cannot unblock');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'spam') $$,
  '42501', null, 'anon cannot report');
reset role;

-- =============================================================================
-- A BLOCKS B (active match)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "1f000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.block_user('1f000000-0000-4000-8000-00000000000a') $$,
  '22023', 'cannot block yourself', 'cannot block yourself');
select throws_ok(
  $$ select * from public.block_user(gen_random_uuid()) $$,
  'P0002', 'user not found', 'cannot block an unknown user');
select throws_ok(
  $$ insert into public.user_blocks (blocker_user_id, blocked_user_id)
     values ('1f000000-0000-4000-8000-00000000000a', '2f000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'direct block inserts are blocked');
select throws_ok(
  $$ insert into public.user_blocks (blocker_user_id, blocked_user_id)
     values ('3f000000-0000-4000-8000-00000000000c', '2f000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'cannot insert a block on behalf of another user');

select results_eq(
  $$ select blocked_user_id from public.block_user('2f000000-0000-4000-8000-00000000000b') $$,
  $$ values ('2f000000-0000-4000-8000-00000000000b'::uuid) $$,
  'A can block B');
select results_eq(
  $$ select blocked_user_id from public.block_user('2f000000-0000-4000-8000-00000000000b') $$,
  $$ values ('2f000000-0000-4000-8000-00000000000b'::uuid) $$,
  'blocking again is idempotent');
select results_eq(
  $$ select blocker_user_id, blocked_user_id from public.user_blocks $$,
  $$ values ('1f000000-0000-4000-8000-00000000000a'::uuid, '2f000000-0000-4000-8000-00000000000b'::uuid) $$,
  'A reads exactly one outgoing block row');
select throws_ok(
  $$ delete from public.user_blocks $$, '42501', null, 'direct block deletes are blocked');
select throws_ok(
  $$ update public.user_blocks set created_at = now() $$, '42501', null, 'direct block updates are blocked');

select results_eq(
  $$ select unmatched_at is not null, unmatched_by from public.matches where id = (select match_ab from fx) $$,
  $$ values (true, '1f000000-0000-4000-8000-00000000000a'::uuid) $$,
  'blocking ended the active match with unmatched_by = blocker');
select results_eq(
  $$ select count(*)::int from public.matches $$, $$ values (1) $$,
  'the match row is preserved (not deleted)');
select throws_ok(
  $$ select * from public.submit_decision('2f000000-0000-4000-8000-00000000000b', 'like') $$,
  '42501', 'interaction unavailable', 'blocker cannot submit decisions about the blocked user');
select throws_ok(
  $$ select * from public.submit_decision('2f000000-0000-4000-8000-00000000000b', 'pass') $$,
  '42501', 'interaction unavailable', 'blocker cannot pass on the blocked user either');
select results_eq(
  $$ select decision from public.user_decisions where target_user_id = '2f000000-0000-4000-8000-00000000000b' $$,
  $$ values ('like'::text) $$,
  'rejected submissions do not modify the existing decision (history kept)');

-- =============================================================================
-- B (blocked user): no visibility, same generic error
-- =============================================================================
set local request.jwt.claims = '{"sub": "2f000000-0000-4000-8000-00000000000b", "role": "authenticated"}';

select is_empty($$ select 1 from public.user_blocks $$, 'blocked user sees no block rows');
select is_empty(
  $$ select 1 from public.user_blocks where blocked_user_id = '2f000000-0000-4000-8000-00000000000b' $$,
  'blocked user cannot look up blocks against them');
select throws_ok(
  $$ select * from public.submit_decision('1f000000-0000-4000-8000-00000000000a', 'like') $$,
  '42501', 'interaction unavailable', 'blocked user gets the SAME generic error (no direction leak)');
select results_eq(
  $$ select unmatched_by, unmatched_at is not null from public.matches $$,
  $$ values ('1f000000-0000-4000-8000-00000000000a'::uuid, true) $$,
  'blocked user sees an ordinary unmatched match (indistinguishable from unmatch)');
select results_eq(
  $$ select unmatched_by from public.unmatch((select match_ab from fx)) $$,
  $$ values ('1f000000-0000-4000-8000-00000000000a'::uuid) $$,
  'unmatch by the blocked user is harmless and does not overwrite unmatched_by');
select is(
  (select count(*)::int from public.block_user('1f000000-0000-4000-8000-00000000000a')),
  1, 'the blocked user can also block back (mutual block)');
select is(
  public.unblock_user('1f000000-0000-4000-8000-00000000000a'), true,
  'B removes only B''s own block');

-- =============================================================================
-- C (third party)
-- =============================================================================
set local request.jwt.claims = '{"sub": "3f000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select is_empty($$ select 1 from public.user_blocks $$, 'third party sees no one else''s blocks');
select is(
  public.unblock_user('2f000000-0000-4000-8000-00000000000b'), false,
  'unblocking an absent block is harmless (and cannot remove A''s block)');

-- =============================================================================
-- D BLOCKS C (already unmatched by C): terminal state untouched
-- =============================================================================
set local request.jwt.claims = '{"sub": "4f000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select lives_ok(
  $$ select * from public.block_user('3f000000-0000-4000-8000-00000000000c') $$,
  'D can block C after C unmatched');
select results_eq(
  $$ select unmatched_by from public.matches where id = (select match_cd from fx) $$,
  $$ values ('3f000000-0000-4000-8000-00000000000c'::uuid) $$,
  'block does not rewrite an already-terminal match');

-- =============================================================================
-- D BLOCKS E (stale reciprocal likes, no match row)
-- =============================================================================
select lives_ok(
  $$ select * from public.block_user('5f000000-0000-4000-8000-00000000000e') $$, 'D blocks E');
select throws_ok(
  $$ select * from public.submit_decision('5f000000-0000-4000-8000-00000000000e', 'like') $$,
  '42501', 'interaction unavailable', 'blocker cannot like the blocked user');
set local request.jwt.claims = '{"sub": "5f000000-0000-4000-8000-00000000000e", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.submit_decision('4f000000-0000-4000-8000-00000000000d', 'like') $$,
  '42501', 'interaction unavailable', 'reverse-blocked user cannot like the blocker');
reset role;
set local request.jwt.claims = '';
select is_empty(
  $$ select 1 from public.matches
      where user_low_id = '4f000000-0000-4000-8000-00000000000d'
        and user_high_id = '5f000000-0000-4000-8000-00000000000e' $$,
  'stale reciprocal likes cannot create a match while the block exists');
select results_eq(
  $$ select count(*)::int from public.user_decisions
      where actor_user_id in ('4f000000-0000-4000-8000-00000000000d', '5f000000-0000-4000-8000-00000000000e')
        and target_user_id in ('4f000000-0000-4000-8000-00000000000d', '5f000000-0000-4000-8000-00000000000e') $$,
  $$ values (2) $$,
  'blocking keeps existing decisions as history');

set local role authenticated;
set local request.jwt.claims = '{"sub": "4f000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select is(public.unblock_user('5f000000-0000-4000-8000-00000000000e'), true, 'D unblocks E');
select is(public.unblock_user('5f000000-0000-4000-8000-00000000000e'), false, 'unblock is idempotent');
reset role;
set local request.jwt.claims = '';
select is_empty(
  $$ select 1 from public.matches
      where user_low_id = '4f000000-0000-4000-8000-00000000000d'
        and user_high_id = '5f000000-0000-4000-8000-00000000000e' $$,
  'unblocking does not silently create a match from old reciprocal likes');

-- =============================================================================
-- A UNBLOCKS B: the terminated match stays terminal
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "1f000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select is(public.unblock_user('2f000000-0000-4000-8000-00000000000b'), true, 'A unblocks B');
select is_empty($$ select 1 from public.user_blocks $$, 'A''s block list is empty after unblocking');
select results_eq(
  $$ select unmatched_at is not null, unmatched_by from public.matches where id = (select match_ab from fx) $$,
  $$ values (true, '1f000000-0000-4000-8000-00000000000a'::uuid) $$,
  'unblocking does not restore the match');
select results_eq(
  $$ select matched, match_id, match_created from public.submit_decision('2f000000-0000-4000-8000-00000000000b', 'like') $$,
  $$ values (false, null::uuid, false) $$,
  'after unblock, decisions work again but the terminal pair does not rematch');

-- =============================================================================
-- REPORTS (A reports B)
-- =============================================================================
select throws_ok(
  $$ select * from public.report_user('1f000000-0000-4000-8000-00000000000a', 'spam') $$,
  '22023', 'cannot report yourself', 'cannot report yourself');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'rude') $$,
  '22023', null, 'invalid reason is rejected');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'other', repeat('x', 2001)) $$,
  '22023', 'details must be at most 2000 characters', 'overlong details are rejected');
select throws_ok(
  $$ select * from public.report_user(gen_random_uuid(), 'spam') $$,
  'P0002', 'user not found', 'cannot report an unknown user');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'scam', null,
                                      (select match_cd from fx)) $$,
  '22023', 'invalid report context', 'related match must be the reporter''s match with the reported user');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'scam', null, null,
                                      'c2000000-0000-4000-8000-000000000001') $$,
  '22023', 'invalid report context', 'related trip must belong to the reporter or the reported user');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'scam', null, gen_random_uuid()) $$,
  '22023', 'invalid report context', 'unknown related match is rejected');

select lives_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'harassment',
                                      '  Repeated unwanted messages.  ', (select match_ab from fx),
                                      'b2000000-0000-4000-8000-000000000001') $$,
  'A reports B with match + (cancelled) reported-user trip context');
select lives_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'other', repeat('y', 2000),
                                      null, 'a2000000-0000-4000-8000-000000000001') $$,
  'a second report (2000-char details, own trip context) is allowed');
select lives_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'spam', '   ') $$,
  'blank details are stored as null');

select results_eq(
  $$ select reporter_user_id, reported_user_id, reason, details
       from public.user_reports order by created_at, reason $$,
  $$ values
       ('1f000000-0000-4000-8000-00000000000a'::uuid, '2f000000-0000-4000-8000-00000000000b'::uuid,
        'harassment'::text, 'Repeated unwanted messages.'::text),
       ('1f000000-0000-4000-8000-00000000000a'::uuid, '2f000000-0000-4000-8000-00000000000b'::uuid,
        'other'::text, repeat('y', 2000)),
       ('1f000000-0000-4000-8000-00000000000a'::uuid, '2f000000-0000-4000-8000-00000000000b'::uuid,
        'spam'::text, null::text) $$,
  'reporter reads own reports (trimmed details, multiple reports per pair)');
select throws_ok(
  $$ select status from public.user_reports $$, '42501', null, 'reporter cannot read moderation status');
select throws_ok(
  $$ select * from public.user_reports $$, '42501', null, 'select * is refused (status column not granted)');
select throws_ok(
  $$ insert into public.user_reports (reporter_user_id, reported_user_id, reason)
     values ('1f000000-0000-4000-8000-00000000000a', '2f000000-0000-4000-8000-00000000000b', 'spam') $$,
  '42501', null, 'direct report inserts are blocked');
select throws_ok(
  $$ update public.user_reports set status = 'dismissed' $$, '42501', null, 'reporter cannot change status');
select throws_ok(
  $$ delete from public.user_reports $$, '42501', null, 'reporter cannot delete reports');
select throws_ok(
  $$ select * from public.report_user('2f000000-0000-4000-8000-00000000000b', 'spam', null, null, null, 'actioned') $$,
  '42883', null, 'report_user has no status parameter');

-- B (reported user) -----------------------------------------------------------
set local request.jwt.claims = '{"sub": "2f000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.user_reports where reported_user_id = '2f000000-0000-4000-8000-00000000000b' $$,
  'reported user cannot read reports against them');
select lives_ok(
  $$ select * from public.report_user('1f000000-0000-4000-8000-00000000000a', 'safety_concern') $$,
  'reporting does not depend on block state (B can report A)');
select results_eq(
  $$ select reporter_user_id, reported_user_id from public.user_reports $$,
  $$ values ('2f000000-0000-4000-8000-00000000000b'::uuid, '1f000000-0000-4000-8000-00000000000a'::uuid) $$,
  'B sees only the report B submitted');
select throws_ok(
  $$ update public.user_reports set status = 'dismissed' $$, '42501', null, 'reported user cannot change status');

-- C (third party) -------------------------------------------------------------
set local request.jwt.claims = '{"sub": "3f000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select is_empty($$ select 1 from public.user_reports $$, 'third party sees no reports');

-- E: blocked by D earlier (now unblocked) — re-block and report to prove no oracle.
set local request.jwt.claims = '{"sub": "4f000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select lives_ok(
  $$ select * from public.block_user('5f000000-0000-4000-8000-00000000000e') $$, 'D re-blocks E');
set local request.jwt.claims = '{"sub": "5f000000-0000-4000-8000-00000000000e", "role": "authenticated"}';
select lives_ok(
  $$ select * from public.report_user('4f000000-0000-4000-8000-00000000000d', 'harassment') $$,
  'a blocked user can still report the blocker (report is not a block oracle)');

-- =============================================================================
-- OWNER / SERVICE: defaults, status ownership, evidence integrity
-- =============================================================================
reset role;
set local request.jwt.claims = '';

select results_eq(
  $$ select distinct status from public.user_reports $$, $$ values ('open'::text) $$,
  'every new report is open');
select results_eq(
  $$ select related_match_id = (select match_ab from fx),
            related_trip_id = 'b2000000-0000-4000-8000-000000000001'::uuid
       from public.user_reports where reason = 'harassment'
        and reporter_user_id = '1f000000-0000-4000-8000-00000000000a' $$,
  $$ values (true, true) $$,
  'related match and trip context are stored');
select lives_ok(
  $$ update public.user_reports set status = 'reviewed' where reason = 'spam' $$,
  'privileged (service/admin) path can change status');
select throws_ok(
  $$ update public.user_reports set details = 'edited' where reason = 'harassment' $$,
  '42501', 'report content cannot be changed', 'report content is immutable even for privileged writes');
select throws_ok(
  $$ update public.user_reports set reported_user_id = '3f000000-0000-4000-8000-00000000000c' where reason = 'spam' $$,
  '42501', 'report content cannot be changed', 'reported user cannot be rewritten');
select throws_ok(
  $$ insert into public.user_blocks (blocker_user_id, blocked_user_id)
     values ('1f000000-0000-4000-8000-00000000000a', '1f000000-0000-4000-8000-00000000000a') $$,
  '23514', null, 'self-block violates the check constraint');
select throws_ok(
  $$ insert into public.user_reports (reporter_user_id, reported_user_id, reason, status)
     values ('1f000000-0000-4000-8000-00000000000a', '2f000000-0000-4000-8000-00000000000b', 'spam', 'closed') $$,
  '23514', null, 'unknown status violates the check constraint');
select lives_ok(
  $$ delete from public.trips where id = 'b2000000-0000-4000-8000-000000000001' $$,
  'deleting a referenced trip is allowed');
select is(
  (select count(*)::int from public.user_reports where reason = 'harassment'
      and reporter_user_id = '1f000000-0000-4000-8000-00000000000a' and related_trip_id is null),
  1, 'report survives with related_trip_id cleared (FK set null passes the immutability trigger)');

-- =============================================================================
-- PRIVILEGES / NO REVERSE LOOKUPS
-- =============================================================================
select ok(
  not has_table_privilege('authenticated', 'public.user_blocks', 'insert')
  and not has_table_privilege('authenticated', 'public.user_blocks', 'update')
  and not has_table_privilege('authenticated', 'public.user_blocks', 'delete')
  and not has_table_privilege('authenticated', 'public.user_reports', 'insert')
  and not has_table_privilege('authenticated', 'public.user_reports', 'update')
  and not has_table_privilege('authenticated', 'public.user_reports', 'delete'),
  'authenticated has no direct write privileges on blocks or reports');
select ok(
  not has_column_privilege('authenticated', 'public.user_reports', 'status', 'select')
  and has_column_privilege('authenticated', 'public.user_reports', 'reason', 'select'),
  'report status is not readable by app clients');
select ok(
  not has_function_privilege('anon', 'public.block_user(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.unblock_user(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.report_user(uuid, text, text, uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.submit_decision(uuid, text, uuid, uuid)', 'execute'),
  'anon cannot execute safety RPCs');
select ok(
  has_function_privilege('authenticated', 'public.block_user(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.unblock_user(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.report_user(uuid, text, text, uuid, uuid)', 'execute'),
  'authenticated can execute safety RPCs');
select is(
  (select string_agg(format('%s/%s/%s', tablename, policyname, cmd), ', ' order by policyname::text collate "C")
     from pg_catalog.pg_policies
    where schemaname = 'public' and tablename::text in ('user_blocks', 'user_reports')),
  'user_blocks/user_blocks_select_own_outgoing/SELECT, user_reports/user_reports_select_own_submitted/SELECT',
  'only owner-side SELECT policies exist (no blocked/reported-side policy)');
select is_empty(
  $$ select 1 from pg_catalog.pg_views
      where schemaname in ('public', 'graphql_public')
        and (definition ilike '%user_blocks%' or definition ilike '%user_reports%') $$,
  'no client-visible view exposes blocks or reports');
select is_empty(
  $$ select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and not exists (select 1 from unnest(p.proconfig) c where c = 'search_path=""')
        and p.proname in ('block_user', 'unblock_user', 'report_user', 'submit_decision') $$,
  'safety RPCs pin search_path to empty');
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_blocks'::regclass)
  and (select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_reports'::regclass),
  'RLS is enabled on user_blocks and user_reports');

-- Cascade: deleting a profile removes their blocks (both directions).
delete from auth.users where id = '5f000000-0000-4000-8000-00000000000e';
select is_empty(
  $$ select 1 from public.user_blocks where blocked_user_id = '5f000000-0000-4000-8000-00000000000e' $$,
  'blocks cascade when a profile is deleted');

select * from finish();
rollback;
