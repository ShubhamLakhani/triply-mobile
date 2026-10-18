-- =============================================================================
-- Pre-3M · M-02 · account states tests (pgTAP)
--
-- Row creation/backfill, privileges/RLS, own-state RPC, helpers and status
-- semantics. Enforcement in profile/onboarding write paths is covered in
-- onboarding_model.test.sql. Everything is rolled back.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- Captures SQLSTATE + DETAIL of a failing statement (throws_ok cannot see DETAIL).
create function pg_temp.error_of(p_sql text)
returns text
language plpgsql
as $$
declare
  v_state text;
  v_detail text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail;
  return v_state || coalesce(':' || nullif(v_detail, ''), '');
end;
$$;

-- Fixtures ------------------------------------------------------------------------
insert into auth.users (id, email)
values
  ('a5000000-0000-4000-8000-00000000000a', 'state-active@example.test'),
  ('b5000000-0000-4000-8000-00000000000b', 'state-suspended@example.test'),
  ('c5000000-0000-4000-8000-00000000000c', 'state-banned@example.test'),
  ('d5000000-0000-4000-8000-00000000000d', 'state-hold@example.test');

-- =============================================================================
-- ROW LIFECYCLE
-- =============================================================================
select results_eq(
  $$ select status, safety_hold_at is null, reason_code is null, suspended_until is null,
            status_changed_at is not null
       from public.account_states where user_id = 'a5000000-0000-4000-8000-00000000000a' $$,
  $$ values ('active'::text, true, true, true, true) $$,
  'a new auth user gets an active account state with no hold');
select is(
  (select count(*)::int from auth.users u
    where (select count(*) from public.account_states s where s.user_id = u.id) <> 1),
  0, 'every auth user has exactly one account state (trigger + backfill)');

-- Backfill statement is idempotent and repairs a missing row.
delete from public.account_states where user_id = 'a5000000-0000-4000-8000-00000000000a';
insert into public.account_states (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
select is(
  (select status from public.account_states where user_id = 'a5000000-0000-4000-8000-00000000000a'),
  'active', 'the backfill recreates a missing row as active and skips existing ones');
select throws_ok(
  $$ insert into public.account_states (user_id) values ('a5000000-0000-4000-8000-00000000000a') $$,
  '23505', null, 'at most one account state per user');
select throws_ok(
  $$ insert into public.account_states (user_id) values (gen_random_uuid()) $$,
  '23503', null, 'an account state requires an auth user');

-- Constraints + trigger -------------------------------------------------------------
select throws_ok(
  $$ update public.account_states set status = 'frozen' where user_id = 'a5000000-0000-4000-8000-00000000000a' $$,
  '23514', null, 'unknown status values are rejected');
select throws_ok(
  $$ update public.account_states set suspended_until = now() + interval '1 day'
      where user_id = 'a5000000-0000-4000-8000-00000000000a' $$,
  '23514', null, 'suspended_until requires status suspended');
select throws_ok(
  $$ update public.account_states set reason_code = 'Bad Code' where user_id = 'a5000000-0000-4000-8000-00000000000a' $$,
  '23514', null, 'reason codes are snake_case');
select throws_ok(
  $$ update public.account_states set user_id = 'b5000000-0000-4000-8000-00000000000b'
      where user_id = 'a5000000-0000-4000-8000-00000000000a' $$,
  '42501', 'account state owner cannot be changed', 'the owner is immutable');

update public.account_states set status_changed_at = '2000-01-01', reason_code = 'note_only'
 where user_id = 'a5000000-0000-4000-8000-00000000000a';
select is(
  (select status_changed_at = '2000-01-01'::timestamptz from public.account_states
    where user_id = 'a5000000-0000-4000-8000-00000000000a'),
  false, 'status_changed_at is trigger-maintained (not writable)');
update public.account_states
   set status = 'suspended', suspended_until = now() + interval '7 days', reason_code = 'policy_review'
 where user_id = 'b5000000-0000-4000-8000-00000000000b';
update public.account_states set status = 'banned' where user_id = 'c5000000-0000-4000-8000-00000000000c';
update public.account_states set safety_hold_at = now(), reason_code = 'underage_concern'
 where user_id = 'd5000000-0000-4000-8000-00000000000d';
select is(
  (select status_changed_at > now() - interval '1 minute' from public.account_states
    where user_id = 'b5000000-0000-4000-8000-00000000000b'),
  true, 'changing status stamps status_changed_at');

-- =============================================================================
-- HELPERS (as owner)
-- =============================================================================
select ok(private.account_is_active('a5000000-0000-4000-8000-00000000000a'), 'active account is active');
select ok(not private.account_is_active('b5000000-0000-4000-8000-00000000000b'), 'suspended account is not active');
select ok(not private.account_is_active('c5000000-0000-4000-8000-00000000000c'), 'banned account is not active');
select ok(private.account_is_active('d5000000-0000-4000-8000-00000000000d'), 'a safety hold alone does not make an account inactive');
select ok(not private.account_is_active(gen_random_uuid()), 'a missing account state is inactive (fail closed)');
select is(private.effective_account_status('suspended', now() - interval '1 second'), 'active',
  'a suspension whose end has passed is effectively active');
select is(private.effective_account_status('suspended', null), 'suspended',
  'an open-ended suspension stays suspended');
select is(private.effective_account_status('deletion_pending', null), 'deletion_pending',
  'other statuses are unchanged');

select throws_ok($$ select private.assert_active_actor() $$, '42501', 'not authenticated',
  'assert_active_actor requires a user');

-- =============================================================================
-- AUTHENTICATED
-- =============================================================================
set local role authenticated;

set local request.jwt.claims = '{"sub": "a5000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select throws_ok($$ select * from public.account_states $$, '42501', null,
  'clients cannot read the account_states table');
select throws_ok(
  $$ update public.account_states set status = 'active' where user_id = 'b5000000-0000-4000-8000-00000000000b' $$,
  '42501', null, 'clients cannot write moderation state');
select throws_ok(
  $$ insert into public.account_states (user_id) values ('a5000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'clients cannot insert account states');
select throws_ok(
  $$ delete from public.account_states $$, '42501', null, 'clients cannot delete account states');
select results_eq(
  $$ select status, suspended_until from public.get_my_account_state() $$,
  $$ values ('active'::text, null::timestamptz) $$,
  'get_my_account_state returns the caller''s own active state');
select throws_ok($$ select private.assert_active_actor() $$, '42501', null,
  'clients cannot call private helpers');
select throws_ok($$ select private.account_is_active('b5000000-0000-4000-8000-00000000000b') $$, '42501', null,
  'clients cannot probe another user''s status');

set local request.jwt.claims = '{"sub": "b5000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select results_eq(
  $$ select status, suspended_until > now() from public.get_my_account_state() $$,
  $$ values ('suspended'::text, true) $$,
  'a suspended user sees their suspension and its end');

set local request.jwt.claims = '{"sub": "c5000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select results_eq(
  $$ select status from public.get_my_account_state() $$,
  $$ values ('banned'::text) $$,
  'a banned user with a live session sees banned');

set local request.jwt.claims = '{"sub": "d5000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select results_eq(
  $$ select status, suspended_until from public.get_my_account_state() $$,
  $$ values ('active'::text, null::timestamptz) $$,
  'a held user sees only active (the hold is silent)');
reset role;

-- Helper behaviour with a caller identity (as owner, simulating each JWT)
set local request.jwt.claims = '{"sub": "a5000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select is(private.assert_active_actor(), 'a5000000-0000-4000-8000-00000000000a'::uuid,
  'assert_active_actor returns the active caller');
set local request.jwt.claims = '{"sub": "b5000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is(pg_temp.error_of('select private.assert_active_actor()'), 'TR001',
  'assert_active_actor raises TR001 for a suspended caller');
set local request.jwt.claims = '{"sub": "c5000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select throws_ok($$ select private.assert_active_actor() $$, 'TR001', 'account inactive',
  'assert_active_actor raises TR001 for a banned caller');
set local request.jwt.claims = '{"sub": "d5000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select is(private.assert_active_actor(), 'd5000000-0000-4000-8000-00000000000d'::uuid,
  'a safety hold does not block the caller');
set local request.jwt.claims = '';

-- anon --------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.get_my_account_state() $$, '42501', null,
  'anon cannot call get_my_account_state');
reset role;

-- Lifecycle: cascade -------------------------------------------------------------
delete from auth.users where id = 'c5000000-0000-4000-8000-00000000000c';
select is(
  (select count(*)::int from public.account_states where user_id = 'c5000000-0000-4000-8000-00000000000c'),
  0, 'deleting the auth user removes the account state');

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.account_states'::regclass)
  and not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'account_states'),
  'account_states has RLS enabled and no client policies');

select * from finish();
rollback;
