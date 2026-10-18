-- =============================================================================
-- Pre-3M · M-03 · profile / onboarding model tests (pgTAP)
--
-- Incremental onboarding, complete_onboarding() validation, post-onboarding
-- invariants (DOB lock, core fields, interests 3-8, >= 1 gender preference,
-- last photo), the discovery pause, server-owned columns, and account-status
-- enforcement on every profile/onboarding write path. Everything is rolled back.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(62);

-- SQLSTATE + DETAIL of a failing statement ('ok' when it succeeds).
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

-- Fixtures (as database owner) ------------------------------------------------------
-- O: onboards step by step · S: suspended · H: on safety hold · L: legacy data
insert into auth.users (id, email)
values
  ('06000000-0000-4000-8000-00000000000a', 'onboard-o@example.test'),
  ('16000000-0000-4000-8000-00000000000b', 'onboard-s@example.test'),
  ('26000000-0000-4000-8000-00000000000c', 'onboard-h@example.test'),
  ('36000000-0000-4000-8000-00000000000d', 'onboard-l@example.test');

update public.account_states set status = 'suspended', reason_code = 'policy_review'
 where user_id = '16000000-0000-4000-8000-00000000000b';
update public.account_states set safety_hold_at = now()
 where user_id = '26000000-0000-4000-8000-00000000000c';

-- L: complete core profile + photo + gender preference, but 9 interests written
-- before the max-8 rule (trigger bypassed for this fixture only) and no
-- discovery_preferences row.
update public.profiles set first_name = 'Lee', gender = 'man', date_of_birth = date '1990-05-05'
 where id = '36000000-0000-4000-8000-00000000000d';
alter table public.profile_interests disable trigger profile_interests_before_insert;
insert into public.profile_interests (user_id, interest_id)
select '36000000-0000-4000-8000-00000000000d', id from public.interests order by slug limit 9;
alter table public.profile_interests enable trigger profile_interests_before_insert;
insert into public.profile_photos (id, user_id, storage_path, position, is_primary, mime_type, file_size_bytes)
values ('a6000000-0000-4000-8000-0000000000d1', '36000000-0000-4000-8000-00000000000d',
        '36000000-0000-4000-8000-00000000000d/a6000000-0000-4000-8000-0000000000d1.jpg', 0, true, 'image/jpeg', 1000);
insert into public.discovery_gender_preferences (user_id, gender)
values ('36000000-0000-4000-8000-00000000000d', 'woman');
delete from public.discovery_preferences where user_id = '36000000-0000-4000-8000-00000000000d';

-- Storage objects the users "uploaded" (the Storage API inserts these as the user).
insert into storage.objects (bucket_id, name, owner_id)
values
  ('profile-photos', '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a1.jpg', '06000000-0000-4000-8000-00000000000a'),
  ('profile-photos', '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a2.jpg', '06000000-0000-4000-8000-00000000000a'),
  ('profile-photos', '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a3.jpg', '06000000-0000-4000-8000-00000000000a');

-- Interest ids by slug for readability.
create temporary table ids on commit drop as
  select slug, id from public.interests where slug in ('hiking', 'yoga', 'food', 'coffee', 'surfing', 'art',
                                                      'music', 'books', 'film', 'wine');
grant select on ids to authenticated;

-- =============================================================================
-- O: INCREMENTAL ONBOARDING (before completion everything stays writable)
-- =============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "06000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select is(pg_temp.error_of('select public.complete_onboarding()'),
  'TR002:profile,photos,interests,gender_preferences',
  'a fresh account cannot complete onboarding; details list every missing requirement');
select is(
  (select onboarding_completed_at from public.profiles where id = '06000000-0000-4000-8000-00000000000a'),
  null, 'onboarding_completed_at starts null');

select is(pg_temp.error_of($$ update public.profiles set date_of_birth = current_date + 1
                               where id = '06000000-0000-4000-8000-00000000000a' $$),
  '23514:date_of_birth_future', 'a future date of birth is rejected');
select is(pg_temp.error_of($$ update public.profiles set date_of_birth = (current_date - interval '17 years')::date
                               where id = '06000000-0000-4000-8000-00000000000a' $$),
  '23514:date_of_birth_under_18', 'an under-18 date of birth is rejected at write');
select lives_ok(
  $$ update public.profiles set first_name = 'Ola', gender = 'woman', date_of_birth = date '1994-03-14'
      where id = '06000000-0000-4000-8000-00000000000a' $$,
  'core profile fields can be saved before completion');
select lives_ok(
  $$ update public.profiles set bio = repeat('b', 500) where id = '06000000-0000-4000-8000-00000000000a' $$,
  'a 500-character bio is accepted');
select throws_ok(
  $$ update public.profiles set bio = repeat('b', 501) where id = '06000000-0000-4000-8000-00000000000a' $$,
  '23514', null, 'a 501-character bio is rejected');
select lives_ok(
  $$ update public.profiles set bio = '   ' where id = '06000000-0000-4000-8000-00000000000a' $$,
  'bio is optional (blank becomes null)');

select is(
  (select count(*)::int from public.replace_profile_interests(array(select id from ids where slug in ('hiking', 'yoga')))),
  2, 'fewer than 3 interests can be saved while onboarding');
select is(
  (select count(*)::int from public.set_discovery_gender_preferences(array[]::text[])),
  0, 'gender preferences can be empty while onboarding');
select is(pg_temp.error_of('select public.complete_onboarding()'),
  'TR002:photos,interests,gender_preferences',
  'completion still lists photos, interests and gender preferences');

select lives_ok(
  $$ select public.register_profile_photo('a6000000-0000-4000-8000-0000000000a1',
       '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a1.jpg', 'image/jpeg', 2048) $$,
  'a photo can be registered while onboarding');
select is(
  public.delete_profile_photo('a6000000-0000-4000-8000-0000000000a1'),
  '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a1.jpg',
  'the only photo can still be deleted before completion');
select lives_ok(
  $$ select public.register_profile_photo('a6000000-0000-4000-8000-0000000000a2',
       '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a2.jpg', 'image/jpeg', 2048) $$,
  'a replacement photo can be registered');

select is(
  (select count(*)::int from public.replace_profile_interests(array(select id from ids where slug in ('hiking', 'yoga', 'food')))),
  3, 'three interests saved');
select is(
  (select count(*)::int from public.set_discovery_gender_preferences(
     array['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'])),
  5, '"Everyone" is stored as every canonical gender value');

-- Server-owned columns ----------------------------------------------------------------
select throws_ok(
  $$ update public.profiles set onboarding_completed_at = now() where id = '06000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'clients cannot set onboarding_completed_at');
select throws_ok(
  $$ update public.profiles set discovery_paused_at = now() where id = '06000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'clients cannot write discovery_paused_at directly');
select throws_ok(
  $$ update public.profiles set is_profile_complete = true where id = '06000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'clients cannot write is_profile_complete');

-- Completion ----------------------------------------------------------------------------
select is(
  (select onboarding_completed_at is not null and is_profile_complete from public.complete_onboarding()),
  true, 'complete_onboarding succeeds once every requirement is met');
select is(
  (select onboarding_completed_at from public.complete_onboarding()),
  (select onboarding_completed_at from public.profiles where id = '06000000-0000-4000-8000-00000000000a'),
  'complete_onboarding is idempotent (timestamp unchanged)');

-- =============================================================================
-- O: POST-ONBOARDING INVARIANTS
-- =============================================================================
select is(pg_temp.error_of($$ update public.profiles set date_of_birth = date '1994-03-15'
                               where id = '06000000-0000-4000-8000-00000000000a' $$),
  'TR003:date_of_birth_locked', 'the date of birth is locked after onboarding');
select is(pg_temp.error_of($$ update public.profiles set first_name = null
                               where id = '06000000-0000-4000-8000-00000000000a' $$),
  'TR003:core_profile_required', 'first name cannot be cleared after onboarding');
select is(pg_temp.error_of($$ update public.profiles set gender = null
                               where id = '06000000-0000-4000-8000-00000000000a' $$),
  'TR003:core_profile_required', 'gender cannot be cleared after onboarding');
select lives_ok(
  $$ update public.profiles set bio = 'Slow travel, fast coffee.', gender = 'non_binary'
      where id = '06000000-0000-4000-8000-00000000000a' $$,
  'bio and gender remain editable after onboarding');

select is(pg_temp.error_of($$ select public.replace_profile_interests(
                                 array(select id from ids where slug in ('hiking', 'yoga'))) $$),
  'TR003:interests_minimum', 'interests cannot drop below 3 after onboarding');
select is(
  (select count(*)::int from public.replace_profile_interests(array(select id from ids where slug in ('surfing', 'art', 'music')))),
  3, 'interests can be swapped while staying at 3+');
select throws_ok(
  $$ select public.replace_profile_interests(array(select id from public.interests order by slug limit 9)) $$,
  '23514', 'a profile can have at most 8 interests', 'more than 8 interests is still rejected');
select is(
  (select count(*)::int from public.profile_interests where user_id = '06000000-0000-4000-8000-00000000000a'),
  3, 'rejected interest saves leave the selection intact');

select is(pg_temp.error_of($$ select public.set_discovery_gender_preferences(array[]::text[]) $$),
  'TR003:gender_preferences_required', 'gender preferences cannot become empty after onboarding');
select is(
  (select count(*)::int from public.set_discovery_gender_preferences(array['woman'])),
  1, 'gender preferences can change while staying non-empty');

select is(pg_temp.error_of($$ select public.delete_profile_photo('a6000000-0000-4000-8000-0000000000a2') $$),
  'TR003:last_photo', 'the last photo cannot be deleted after onboarding');
select lives_ok(
  $$ select public.register_profile_photo('a6000000-0000-4000-8000-0000000000a3',
       '06000000-0000-4000-8000-00000000000a/a6000000-0000-4000-8000-0000000000a3.jpg', 'image/jpeg', 2048) $$,
  'replace flow, step 1: register the new photo');
select lives_ok(
  $$ select public.delete_profile_photo('a6000000-0000-4000-8000-0000000000a2') $$,
  'replace flow, step 2: the old photo can now be deleted');
select results_eq(
  $$ select id, is_primary, position::int from public.profile_photos
      where user_id = '06000000-0000-4000-8000-00000000000a' $$,
  $$ values ('a6000000-0000-4000-8000-0000000000a3'::uuid, true, 0) $$,
  'after replacing, the new photo is the primary at position 0');
select is(pg_temp.error_of($$ select public.delete_profile_photo('a6000000-0000-4000-8000-0000000000a3') $$),
  'TR003:last_photo', 'the replacement is now the protected last photo');

-- Discovery pause ------------------------------------------------------------------------
select isnt(public.set_discovery_paused(true), null, 'pausing stores a timestamp');
select is(
  public.set_discovery_paused(true),
  (select discovery_paused_at from public.profiles where id = '06000000-0000-4000-8000-00000000000a'),
  'pausing again keeps the original pause time');
select is(public.set_discovery_paused(false), null, 'resuming clears the pause');
select throws_ok($$ select public.set_discovery_paused(null) $$, '22023', null, 'pause requires true or false');

select results_eq(
  $$ select is_profile_complete, onboarding_completed_at is not null, discovery_paused_at is null, is_discoverable
       from public.profiles where id = '06000000-0000-4000-8000-00000000000a' $$,
  $$ values (true, true, true, false) $$,
  'server state persisted: complete, onboarded, not paused, deprecated flag false');

-- =============================================================================
-- L: LEGACY DATA (9 interests, no preferences row)
-- =============================================================================
set local request.jwt.claims = '{"sub": "36000000-0000-4000-8000-00000000000d", "role": "authenticated"}';
select is(pg_temp.error_of('select public.complete_onboarding()'), 'TR002:interests,age_range',
  'more than 8 interests (legacy) or a missing age range blocks completion');

-- =============================================================================
-- S: SUSPENDED (every profile/onboarding write is rejected with TR001)
-- =============================================================================
set local request.jwt.claims = '{"sub": "16000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is(pg_temp.error_of($$ update public.profiles set bio = 'x' where id = '16000000-0000-4000-8000-00000000000b' $$),
  'TR001', 'suspended: profile update rejected');
select is(pg_temp.error_of($$ update public.discovery_preferences set min_age = 30
                               where user_id = '16000000-0000-4000-8000-00000000000b' $$),
  'TR001', 'suspended: preference update rejected');
select is(pg_temp.error_of($$ select public.replace_profile_interests(array(select id from ids where slug in ('hiking', 'yoga', 'food'))) $$),
  'TR001', 'suspended: interest save rejected');
select is(pg_temp.error_of($$ select public.set_discovery_gender_preferences(array['man']) $$),
  'TR001', 'suspended: gender preference save rejected');
select is(pg_temp.error_of($$ select public.register_profile_photo('a6000000-0000-4000-8000-0000000000b1',
                               '16000000-0000-4000-8000-00000000000b/a6000000-0000-4000-8000-0000000000b1.jpg', 'image/jpeg', 10) $$),
  'TR001', 'suspended: photo registration rejected');
select is(pg_temp.error_of($$ select public.delete_profile_photo('a6000000-0000-4000-8000-0000000000b1') $$),
  'TR001', 'suspended: photo deletion rejected');
select is(pg_temp.error_of($$ select public.set_primary_profile_photo('a6000000-0000-4000-8000-0000000000b1') $$),
  'TR001', 'suspended: set primary photo rejected');
select is(pg_temp.error_of($$ select public.reorder_profile_photos(array[]::uuid[]) $$),
  'TR001', 'suspended: photo reorder rejected');
select is(pg_temp.error_of('select public.complete_onboarding()'),
  'TR001', 'suspended: cannot complete onboarding');
select is(pg_temp.error_of('select public.set_discovery_paused(true)'),
  'TR001', 'suspended: cannot change the discovery pause');
select is(
  (select count(*)::int from public.profiles where id = '16000000-0000-4000-8000-00000000000b'),
  1, 'suspended users can still read their own profile');

-- H: a safety hold is silent and does not block writes
set local request.jwt.claims = '{"sub": "26000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select lives_ok(
  $$ update public.profiles set first_name = 'Hana' where id = '26000000-0000-4000-8000-00000000000c' $$,
  'a held account can still edit its profile');

-- =============================================================================
-- AS DATABASE OWNER (support / server context: no user JWT)
-- =============================================================================
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ update public.profiles set onboarding_completed_at = null where id = '06000000-0000-4000-8000-00000000000a' $$,
  '42501', 'onboarding completion cannot be changed', 'onboarding completion cannot be cleared, even by privileged writes');
select throws_ok(
  $$ update public.profiles set onboarding_completed_at = now() - interval '1 day'
      where id = '06000000-0000-4000-8000-00000000000a' $$,
  '42501', 'onboarding completion cannot be changed', 'onboarding completion cannot be rewritten');
select lives_ok(
  $$ update public.profiles set date_of_birth = date '1994-03-15' where id = '06000000-0000-4000-8000-00000000000a' $$,
  'support (no user JWT) can correct a locked date of birth');
select throws_ok(
  $$ update public.profiles set date_of_birth = (current_date - interval '16 years')::date
      where id = '06000000-0000-4000-8000-00000000000a' $$,
  '23514', 'you must be 18 or older', 'even support cannot store an under-18 date of birth');

-- anon --------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.complete_onboarding() $$, '42501', null, 'anon cannot complete onboarding');
select throws_ok($$ select public.set_discovery_paused(true) $$, '42501', null, 'anon cannot pause discovery');
reset role;

-- Privilege surface ---------------------------------------------------------------------
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'onboarding_completed_at', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'discovery_paused_at', 'update')
  and not has_column_privilege('authenticated', 'public.profiles', 'is_discoverable', 'update'),
  'server-owned profile columns have no client UPDATE privilege');
select ok(
  has_function_privilege('authenticated', 'public.complete_onboarding()', 'execute')
  and has_function_privilege('authenticated', 'public.set_discovery_paused(boolean)', 'execute')
  and not has_function_privilege('authenticated', 'private.onboarding_missing_requirements(uuid)', 'execute'),
  'signed-in users can call the onboarding RPCs but not the private requirement check');

select * from finish();
rollback;
