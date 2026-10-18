-- =============================================================================
-- Pre-3M · M-01 · canonical interest catalog tests (pgTAP)
--
-- The catalog ships in migrations (not seed.sql), so these assertions hold on
-- every environment. Everything is rolled back.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- Catalog rows -------------------------------------------------------------------
select is(
  (select count(*)::int from public.interests
    where slug in ('adventure', 'beaches', 'camping', 'diving', 'hiking', 'island-hopping',
                   'road-trips', 'surfing', 'fitness', 'meditation', 'running', 'wellness',
                   'yoga', 'art', 'books', 'culture', 'film', 'history', 'languages', 'music',
                   'photography', 'coffee', 'cooking', 'digital-nomad', 'food', 'street-food',
                   'wine', 'festivals', 'nightlife', 'volunteering')
      and active),
  30, 'all 30 launch interests exist and are active');
select is(
  (select count(*)::int from (
     select slug from public.interests group by slug having count(*) > 1) d),
  0, 'every slug exists exactly once');
select results_eq(
  $$ select category, count(*)::int from public.interests
      where slug in ('adventure', 'beaches', 'camping', 'diving', 'hiking', 'island-hopping',
                     'road-trips', 'surfing', 'fitness', 'meditation', 'running', 'wellness',
                     'yoga', 'art', 'books', 'culture', 'film', 'history', 'languages', 'music',
                     'photography', 'coffee', 'cooking', 'digital-nomad', 'food', 'street-food',
                     'wine', 'festivals', 'nightlife', 'volunteering')
      group by category order by category $$,
  $$ values ('culture'::text, 8), ('lifestyle', 6), ('outdoors', 8), ('social', 3), ('wellness', 5) $$,
  'launch interests are grouped into the five picker categories');
select results_eq(
  $$ select label from public.interests where slug in ('diving', 'digital-nomad', 'street-food') order by slug $$,
  $$ values ('Digital nomad'::text), ('Diving & snorkelling'), ('Street food') $$,
  'labels are user-facing text');
select is(
  (select count(*)::int from public.interests where active and category is null),
  0, 'every active interest is categorised');

-- Idempotent upsert semantics (what every catalog_vN migration relies on) ----------
create temporary table catalog_before on commit drop as
  select id, slug from public.interests;
insert into public.interests (slug, label, category)
values ('hiking', 'Hiking', 'outdoors'), ('yoga', 'Yoga', 'wellness')
on conflict (slug) do update
  set label = excluded.label, category = excluded.category, active = true;
select is(
  (select count(*)::int from public.interests),
  (select count(*)::int from catalog_before),
  're-applying the upsert creates no rows');
select is(
  (select count(*)::int from public.interests i join catalog_before b using (slug) where i.id <> b.id),
  0, 're-applying the upsert keeps existing ids (selections stay valid)');
insert into auth.users (id, email) values ('f0000000-0000-4000-8000-000000000001', 'catalog@example.test');
insert into public.profile_interests (user_id, interest_id)
select 'f0000000-0000-4000-8000-000000000001', id from public.interests where slug = 'hiking';
select throws_ok(
  $$ delete from public.interests where slug = 'hiking' $$,
  '23503', null, 'a selected interest cannot be deleted from the catalog (deactivate it instead)');

-- Visibility -------------------------------------------------------------------------
update public.interests set active = false where slug = 'volunteering';

set local role authenticated;
set local request.jwt.claims = '{"sub": "f0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  (select count(*)::int from public.interests where slug = 'volunteering'),
  0, 'a deactivated interest is hidden from clients');
select is(
  (select count(*)::int from public.interests where slug = 'yoga'),
  1, 'active interests are visible to signed-in users');
reset role;

set local role anon;
select throws_ok($$ select 1 from public.interests $$, '42501', null, 'anon cannot read the catalog');
reset role;

select ok(
  not has_table_privilege('authenticated', 'public.interests', 'insert')
  and not has_table_privilege('authenticated', 'public.interests', 'update')
  and not has_table_privilege('authenticated', 'public.interests', 'delete'),
  'clients cannot write the catalog');

select * from finish();
rollback;
