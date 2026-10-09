-- =============================================================================
-- Phase 1M-G · profile photos + storage tests (pgTAP)
--
-- Run against the local Supabase stack:   npx supabase test db
-- Run without Docker (plain PostgreSQL):  npm run test:db
--
-- Storage note: in the plain-Postgres harness, storage.objects/buckets come from
-- scripts/db-test/supabase-shim.sql. Inserting/deleting rows in storage.objects
-- AS the user is exactly how the Storage API applies RLS, so the policies are
-- exercised for real; the Storage API's own bucket limits (size/MIME) and
-- signed URLs are not emulated here (covered by the bucket config assertions).
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(73);

-- Fixtures (as database owner) ------------------------------------------------
insert into auth.users (id, email)
values ('1e000000-0000-4000-8000-00000000000a', 'photos-a@example.test'), ('2e000000-0000-4000-8000-00000000000b', 'photos-b@example.test');
insert into storage.buckets (id, name, public) values ('test-other-bucket', 'test-other-bucket', false);

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'profile-photos' $$,
  $$ values (false, 10485760::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'profile-photos bucket is private, 10 MiB, jpeg/png/webp only');

-- ANON ----------------------------------------------------------------------
set local role anon;
select throws_ok($$ select id from public.profile_photos $$, '42501', null, 'anon cannot read photo metadata');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 1000, null, null) $$, '42501', null, 'anon cannot register photos');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', '1e000000-0000-4000-8000-00000000000a') $$, '42501', null, 'anon cannot upload objects');
select is_empty($$ select 1 from storage.objects where bucket_id = 'profile-photos' $$, 'anon sees no objects');
reset role;
set local request.jwt.claims = '';

-- A: STORAGE POLICIES -------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "1e000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', '1e000000-0000-4000-8000-00000000000a') $$, 'A can upload into own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '2e000000-0000-4000-8000-00000000000b/ab000000-0000-4000-8000-000000000009.jpg', '2e000000-0000-4000-8000-00000000000b') $$, '42501', null, 'A cannot upload into another user''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/avatar.gif') $$, '42501', null, 'non-canonical object names are refused');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/nested/ab000000-0000-4000-8000-000000000009.jpg') $$, '42501', null, 'nested paths are refused');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('test-other-bucket', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg') $$, '42501', null, 'policies do not open other buckets');
select results_eq($$ select count(*)::int from storage.objects $$, $$ values (1) $$, 'A sees own object');

-- A: REGISTER ---------------------------------------------------------------
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '2e000000-0000-4000-8000-00000000000b/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 1000) $$, '22023', 'invalid storage path', 'foreign-folder path is rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/png', 1000) $$, '22023', 'invalid storage path', 'path extension must match the MIME type');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/../ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 1000) $$, '22023', 'invalid storage path', 'arbitrary paths are rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.gif', 'image/gif', 1000) $$, '22023', 'unsupported image type', 'gif is rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.heic', 'image/heic', 1000) $$, '22023', 'unsupported image type', 'heic is rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 10485761, null, null) $$, '22023', 'image must be between 1 byte and 10 MB', 'oversized file is rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 0, null, null) $$, '22023', 'image must be between 1 byte and 10 MB', 'empty file is rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 1000, 0, 100) $$, '22023', 'invalid image dimensions', 'non-positive dimensions are rejected');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000002', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000002.jpg', 'image/jpeg', 1000, null, null) $$, 'P0002', 'photo upload not found', 'cannot register a photo that was not uploaded');
select results_eq(
  $$ select user_id, position::int, is_primary, width, height from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 2048, 1080, 1350) $$,
  $$ values ('1e000000-0000-4000-8000-00000000000a'::uuid, 0, true, 1080, 1350) $$,
  'first photo: owner = caller, position 0, primary');
select results_eq(
  $$ select id, position::int from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 2048, 1080, 1350) $$,
  $$ values ('ab000000-0000-4000-8000-000000000001'::uuid, 0) $$,
  're-registering the same photo is idempotent');
select results_eq($$ select count(*)::int from public.profile_photos $$, $$ values (1) $$, 'idempotent retry created no duplicate');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg', 1, 'image/jpeg', 1) $$, '42501', null, 'direct metadata inserts are blocked');
select throws_ok($$ update public.profile_photos set is_primary = false $$, '42501', null, 'direct metadata updates are blocked');
select throws_ok($$ delete from public.profile_photos $$, '42501', null, 'direct metadata deletes are blocked');
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000002.png', '1e000000-0000-4000-8000-00000000000a');
select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000002', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000002.png', 'image/png', 1000, null, null);
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000003.webp', '1e000000-0000-4000-8000-00000000000a');
select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000003', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000003.webp', 'image/webp', 1000, null, null);
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000004.jpg', '1e000000-0000-4000-8000-00000000000a');
select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000004', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000004.jpg', 'image/jpeg', 1000, null, null);
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000005.jpg', '1e000000-0000-4000-8000-00000000000a');
select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000005', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000005.jpg', 'image/jpeg', 1000, null, null);
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000006.jpg', '1e000000-0000-4000-8000-00000000000a');
select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000006', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000006.jpg', 'image/jpeg', 1000, null, null);
select results_eq(
  $$ select id, position::int, is_primary from public.profile_photos order by position $$,
  $$ values ('ab000000-0000-4000-8000-000000000001'::uuid, 0, true), ('ab000000-0000-4000-8000-000000000002'::uuid, 1, false), ('ab000000-0000-4000-8000-000000000003'::uuid, 2, false),
            ('ab000000-0000-4000-8000-000000000004'::uuid, 3, false), ('ab000000-0000-4000-8000-000000000005'::uuid, 4, false), ('ab000000-0000-4000-8000-000000000006'::uuid, 5, false) $$,
  'next positions assigned 0..5; later photos are not primary');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000007.jpg', '1e000000-0000-4000-8000-00000000000a') $$, 'a 7th object can be uploaded (registration is the limit)');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000007', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000007.jpg', 'image/jpeg', 1000, null, null) $$, '54000', 'profile photo limit reached', '7th photo is rejected');
select results_eq(
  $$ delete from storage.objects where name = '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000007.jpg' returning name $$,
  $$ values ('1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000007.jpg') $$,
  'A can delete an unregistered object (upload cleanup)');
select is_empty(
  $$ delete from storage.objects where name = '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000002.png' returning name $$,
  'a registered photo object cannot be deleted directly (delete metadata first)');

-- B: CROSS-USER -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "2e000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is_empty($$ select 1 from public.profile_photos $$, 'B cannot read A''s photo metadata');
select is_empty($$ select 1 from storage.objects where bucket_id = 'profile-photos' $$, 'B cannot see A''s objects (no signed URLs possible)');
select is_empty($$ delete from storage.objects where name = '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg' returning 1 $$, 'B cannot delete A''s objects');
select throws_ok($$ select public.delete_profile_photo('ab000000-0000-4000-8000-000000000001') $$, 'P0002', 'photo not found', 'B cannot delete A''s photo (not found)');
select throws_ok($$ select * from public.set_primary_profile_photo('ab000000-0000-4000-8000-000000000002') $$, 'P0002', 'photo not found', 'B cannot set A''s primary');
select throws_ok($$ select * from public.register_profile_photo('ab000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 2048) $$, '22023', 'invalid storage path', 'B cannot register A''s object');
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '2e000000-0000-4000-8000-00000000000b/bb000000-0000-4000-8000-000000000001.jpg', '2e000000-0000-4000-8000-00000000000b');
select * from public.register_profile_photo('bb000000-0000-4000-8000-000000000001', '2e000000-0000-4000-8000-00000000000b/bb000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 1000, null, null);
select throws_ok($$ select * from public.reorder_profile_photos(array['ab000000-0000-4000-8000-000000000001'::uuid]) $$, '22023', null, 'B cannot reorder with A''s photo ids');

-- A: SET PRIMARY ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "1e000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select results_eq(
  $$ select id from public.set_primary_profile_photo('ab000000-0000-4000-8000-000000000003') where is_primary $$,
  $$ values ('ab000000-0000-4000-8000-000000000003'::uuid) $$,
  'set primary switches atomically');
select results_eq($$ select count(*)::int from public.profile_photos where is_primary $$, $$ values (1) $$, 'exactly one primary after set primary');
select throws_ok($$ select * from public.set_primary_profile_photo('bb000000-0000-4000-8000-000000000001') $$, 'P0002', 'photo not found', 'cannot set another user''s photo as primary');
select results_eq($$ select count(*)::int from public.set_primary_profile_photo('ab000000-0000-4000-8000-000000000003') where is_primary $$, $$ values (1) $$, 'setting the current primary again is harmless');

-- A: REORDER ----------------------------------------------------------------
select throws_ok($$ select * from public.reorder_profile_photos(array['ab000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000005']::uuid[]) $$, '22023', null, 'duplicate ids are rejected');
select throws_ok($$ select * from public.reorder_profile_photos(array['ab000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000005']::uuid[]) $$, '22023', null, 'missing ids are rejected');
select throws_ok($$ select * from public.reorder_profile_photos(array['ab000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000005', 'bb000000-0000-4000-8000-000000000001']::uuid[]) $$, '22023', null, 'foreign ids are rejected');
select throws_ok($$ select * from public.reorder_profile_photos(array['ab000000-0000-4000-8000-000000000001', null, 'ab000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000006']::uuid[]) $$, '22023', null, 'null ids are rejected');
select throws_ok($$ select * from public.reorder_profile_photos(null) $$, '22023', null, 'null list is rejected');
select results_eq(
  $$ select id, position::int, is_primary from public.reorder_profile_photos(array['ab000000-0000-4000-8000-000000000006', 'ab000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001']::uuid[]) $$,
  $$ values ('ab000000-0000-4000-8000-000000000006'::uuid, 0, false), ('ab000000-0000-4000-8000-000000000005'::uuid, 1, false), ('ab000000-0000-4000-8000-000000000004'::uuid, 2, false),
            ('ab000000-0000-4000-8000-000000000003'::uuid, 3, true), ('ab000000-0000-4000-8000-000000000002'::uuid, 4, false), ('ab000000-0000-4000-8000-000000000001'::uuid, 5, false) $$,
  'valid reorder: contiguous positions, primary preserved');

-- A: DELETE -----------------------------------------------------------------
select is(public.delete_profile_photo('ab000000-0000-4000-8000-000000000005'), '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000005.jpg', 'owner deletes a photo and gets its storage path');
select results_eq(
  $$ select id, position::int, is_primary from public.profile_photos order by position $$,
  $$ values ('ab000000-0000-4000-8000-000000000006'::uuid, 0, false), ('ab000000-0000-4000-8000-000000000004'::uuid, 1, false), ('ab000000-0000-4000-8000-000000000003'::uuid, 2, true),
            ('ab000000-0000-4000-8000-000000000002'::uuid, 3, false), ('ab000000-0000-4000-8000-000000000001'::uuid, 4, false) $$,
  'deleting a non-primary keeps the primary and renumbers positions');
select is(public.delete_profile_photo('ab000000-0000-4000-8000-000000000003'), '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000003.webp', 'owner deletes the primary photo');
select results_eq(
  $$ select id, position::int, is_primary from public.profile_photos order by position $$,
  $$ values ('ab000000-0000-4000-8000-000000000006'::uuid, 0, true), ('ab000000-0000-4000-8000-000000000004'::uuid, 1, false), ('ab000000-0000-4000-8000-000000000002'::uuid, 2, false),
            ('ab000000-0000-4000-8000-000000000001'::uuid, 3, false) $$,
  'deleting the primary promotes the first remaining photo; positions contiguous');
select throws_ok($$ select public.delete_profile_photo('ab000000-0000-4000-8000-000000000003') $$, 'P0002', 'photo not found', 'deleting again is a privacy-safe not-found');
select throws_ok($$ select public.delete_profile_photo('bb000000-0000-4000-8000-000000000001') $$, 'P0002', 'photo not found', 'cannot delete another user''s photo');
select results_eq(
  $$ delete from storage.objects where name in ('1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000005.jpg', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000003.webp') returning name $$,
  $$ values ('1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000003.webp'), ('1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000005.jpg') $$,
  'after metadata deletion the owner can remove the objects');
insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000007.jpg', '1e000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select position::int, is_primary from public.register_profile_photo('ab000000-0000-4000-8000-000000000007', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000007.jpg', 'image/jpeg', 500) $$,
  $$ values (4, false) $$,
  'deletion frees a slot; the new photo takes the next position');

-- OWNER: constraints (defense in depth) --------------------------------------
reset role;
set local request.jwt.claims = '';
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000001.jpg', 5, 'image/jpeg', 1) $$, '23514', null, 'storage path must be canonical for the row');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg', 0, 'image/jpeg', 1) $$, '23505', null, 'duplicate position is prevented');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, is_primary, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg', 5, true, 'image/jpeg', 1) $$, '23505', null, 'a second primary is prevented');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg', 6, 'image/jpeg', 1) $$, '23514', null, 'position 6 (7th photo) is impossible');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000001', '2e000000-0000-4000-8000-00000000000b', '2e000000-0000-4000-8000-00000000000b/ab000000-0000-4000-8000-000000000001.jpg', 1, 'image/jpeg', 1) $$, '23505', null, 'duplicate photo id / path is prevented');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.gif', 5, 'image/gif', 1) $$, '23514', null, 'unsupported MIME type violates the check');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg', 5, 'image/jpeg', 10485761) $$, '23514', null, 'oversized file violates the check');
select throws_ok($$ insert into public.profile_photos (id, user_id, storage_path, position, mime_type, file_size_bytes, width) values ('ab000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg', 5, 'image/jpeg', 1, -1) $$, '23514', null, 'invalid width violates the check');
select throws_ok($$ update public.profile_photos set storage_path = '1e000000-0000-4000-8000-00000000000a/ab000000-0000-4000-8000-000000000009.jpg' where id = 'ab000000-0000-4000-8000-000000000001' $$, '42501', 'profile photo identity cannot be changed', 'identity fields are immutable even for privileged writes');

-- PRIVILEGES ----------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.profile_photos', 'insert')
  and not has_table_privilege('authenticated', 'public.profile_photos', 'update')
  and not has_table_privilege('authenticated', 'public.profile_photos', 'delete')
  and not has_table_privilege('anon', 'public.profile_photos', 'select'),
  'no direct metadata writes for app roles; anon cannot read');
select ok(
  not has_function_privilege('anon', 'public.register_profile_photo(uuid, text, text, integer, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.delete_profile_photo(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.set_primary_profile_photo(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.reorder_profile_photos(uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.reorder_profile_photos(uuid[])', 'execute')
  and not has_function_privilege('authenticated', 'private.normalize_profile_photos(uuid)', 'execute'),
  'photo RPCs: authenticated only; private helpers not callable');
select is(
  (select string_agg(format('%s:%s', policyname, cmd), ', ' order by policyname::text collate "C")
     from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname::text like 'profile_photos_%'),
  'profile_photos_objects_delete_own_unregistered:DELETE, profile_photos_objects_insert_own:INSERT, profile_photos_objects_select_own:SELECT',
  'storage policies: select/insert/delete own only, no update, authenticated only');
select is_empty(
  $$ select 1 from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname::text like 'profile_photos_%'
        and roles <> '{authenticated}'::name[] $$,
  'storage policies apply to authenticated only (anon has none)');
select is_empty(
  $$ select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('register_profile_photo', 'delete_profile_photo', 'set_primary_profile_photo', 'reorder_profile_photos')
        and (not p.prosecdef or not exists (select 1 from unnest(p.proconfig) c where c = 'search_path=""')) $$,
  'photo RPCs are SECURITY DEFINER with an empty search_path');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.profile_photos'::regclass), 'RLS is enabled on profile_photos');
select is(
  (select is_profile_complete from public.profiles where id = '1e000000-0000-4000-8000-00000000000a'), false,
  'photos do not change profile completeness (unchanged Phase 1M-B rule)');
delete from auth.users where id = '2e000000-0000-4000-8000-00000000000b';
select is_empty($$ select 1 from public.profile_photos where user_id = '2e000000-0000-4000-8000-00000000000b' $$, 'photo metadata cascades when a profile is deleted');

select * from finish();
rollback;
