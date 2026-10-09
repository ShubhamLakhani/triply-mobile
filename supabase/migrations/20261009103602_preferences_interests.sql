-- =============================================================================
-- Triply · Phase 1M-D · Preferences + interests
-- =============================================================================
--
-- Adds the preference and interest model future discovery will consume.
-- Everything here is owner-only; nothing exposes another user's interests or
-- preferences. Discovery (a later phase) will read these through a controlled
-- SECURITY DEFINER RPC that returns only discovery-safe, derived results
-- (e.g. "3 shared interests"), never raw rows.
--
-- Tables
--   public.interests                     controlled catalog (read-only to clients)
--   public.profile_interests             user ↔ interest selections (max 10)
--   public.discovery_preferences         exactly one row per profile
--   public.discovery_gender_preferences  0..n genders the user wants to meet
--
-- Interests
--   * Clients read ACTIVE interests only; catalog writes are service_role /
--     migration / seed only. No free-text interests.
--   * A user may select at most 10 interests (MVP: keeps profiles focused and
--     shared-interest signals meaningful). Enforced by a BEFORE INSERT trigger
--     that serialises per user with an advisory lock, so concurrent inserts
--     cannot exceed the limit. Inactive interests cannot be newly selected;
--     existing selections of a later-deactivated interest remain until removed.
--   * Selections are added/removed (no UPDATE). Duplicates are blocked by the
--     composite primary key.
--
-- Discovery preferences
--   * min_age 18..99, max_age <= 99, max_age >= min_age (defaults 18–99).
--   * minimum_overlap_days 1..60 (default 1): how many shared days a trip
--     overlap needs. 60 prevents absurd input without limiting real travel.
--   * max_distance_km: optional, 1..20000, future-facing only. Triply does not
--     collect live/GPS location; nothing in this phase uses this field.
--   * Created automatically for every profile (AFTER INSERT trigger on
--     public.profiles) and backfilled below for existing profiles. Clients may
--     only SELECT/UPDATE their own row; no INSERT/DELETE.
--
-- Gender preferences
--   * Normalised rows; values match profiles.gender (man, woman, non_binary,
--     other, prefer_not_to_say). No "everyone" sentinel: selecting all values
--     means everyone. No rows = not configured yet (discovery decides how to
--     treat that; onboarding should require at least one).
--
-- Atomic replacement RPCs (SECURITY INVOKER: RLS and grants still apply)
--   public.replace_profile_interests(uuid[])
--   public.set_discovery_gender_preferences(text[])
--   Each call runs in one transaction, so a multi-select save can never leave
--   a partial state. Executable by authenticated only.
--
-- Indexes
--   profile_interests_interest_id_idx  FK on interest_id (catalog deactivation /
--                                      restrict checks) and future shared-interest
--                                      lookups. user_id lookups use the PK.
--   No extra index on discovery_gender_preferences: per-user reads use the PK;
--   a reverse (gender) index can be added with the discovery RPC if needed.
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   drop function if exists public.set_discovery_gender_preferences(text[]);
--   drop function if exists public.replace_profile_interests(uuid[]);
--   drop trigger if exists on_profile_created_create_discovery_preferences on public.profiles;
--   drop table if exists public.discovery_gender_preferences, public.discovery_preferences,
--     public.profile_interests, public.interests;
--   drop function if exists private.handle_new_profile(),
--     private.profile_interests_before_insert(),
--     private.discovery_preferences_before_update();
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.interests (catalog)
-- -----------------------------------------------------------------------------

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint interests_slug_key unique (slug),
  constraint interests_slug_format
    check (char_length(slug) between 2 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint interests_label_valid
    check (char_length(label) between 1 and 60 and label = btrim(label)),
  constraint interests_category_format
    check (category is null or (char_length(category) between 2 and 40
           and category ~ '^[a-z]+(-[a-z]+)*$'))
);

comment on table public.interests is
  'Controlled interest catalog. Clients read active rows only; written by migrations/seed/server tooling.';

create trigger set_updated_at
  before update on public.interests
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- public.profile_interests (selections)
-- -----------------------------------------------------------------------------

create table public.profile_interests (
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  interest_id uuid not null
    references public.interests (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);

comment on table public.profile_interests is
  'A user''s selected interests (max 10). Owner-only; add/remove, no update.';

create index profile_interests_interest_id_idx on public.profile_interests (interest_id);

-- SECURITY INVOKER: the active-interest lookup and the count run under the
-- caller's RLS (clients see active interests and only their own selections).
create or replace function private.profile_interests_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();

  if not exists (
    select 1 from public.interests i where i.id = new.interest_id and i.active
  ) then
    raise exception 'interest is not available' using errcode = '23503';
  end if;

  -- Serialise selections per user so concurrent inserts cannot exceed the limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.profile_interests:' || new.user_id::text, 0)
  );

  if (select count(*) from public.profile_interests pi where pi.user_id = new.user_id) >= 10 then
    raise exception 'a profile can have at most 10 interests' using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function private.profile_interests_before_insert() is
  'BEFORE INSERT on public.profile_interests: active interests only, max 10 per user, DB-controlled created_at.';

create trigger profile_interests_before_insert
  before insert on public.profile_interests
  for each row execute function private.profile_interests_before_insert();

-- -----------------------------------------------------------------------------
-- public.discovery_preferences (one row per profile)
-- -----------------------------------------------------------------------------

create table public.discovery_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  min_age smallint not null default 18,
  max_age smallint not null default 99,
  minimum_overlap_days smallint not null default 1,
  max_distance_km integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint discovery_preferences_min_age_adult check (min_age >= 18),
  constraint discovery_preferences_max_age_bound check (max_age <= 99),
  constraint discovery_preferences_age_range_valid check (max_age >= min_age),
  constraint discovery_preferences_overlap_days_range
    check (minimum_overlap_days between 1 and 60),
  constraint discovery_preferences_max_distance_range
    check (max_distance_km is null or max_distance_km between 1 and 20000)
);

comment on table public.discovery_preferences is
  'Exactly one row per profile (auto-created). Owner-only SELECT/UPDATE.';
comment on column public.discovery_preferences.minimum_overlap_days is
  'Minimum shared trip days required for discovery (1..60).';
comment on column public.discovery_preferences.max_distance_km is
  'Optional, future-facing only. Triply does not collect live location.';

create or replace function private.discovery_preferences_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'discovery preferences owner cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger discovery_preferences_before_update
  before update on public.discovery_preferences
  for each row execute function private.discovery_preferences_before_update();

create trigger set_updated_at
  before update on public.discovery_preferences
  for each row execute function private.set_updated_at();

-- Default row for every new profile. SECURITY DEFINER: profile rows are created
-- by private.handle_new_user() on behalf of Supabase Auth; clients have no
-- INSERT privilege on discovery_preferences. Idempotent.
create or replace function private.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.discovery_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function private.handle_new_profile() is
  'AFTER INSERT on public.profiles: creates the default discovery_preferences row.';

create trigger on_profile_created_create_discovery_preferences
  after insert on public.profiles
  for each row execute function private.handle_new_profile();

-- Backfill existing profiles (idempotent).
insert into public.discovery_preferences (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- public.discovery_gender_preferences
-- -----------------------------------------------------------------------------

create table public.discovery_gender_preferences (
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  gender text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, gender),

  constraint discovery_gender_preferences_gender_valid
    check (gender in ('man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'))
);

comment on table public.discovery_gender_preferences is
  'Genders a user wants to meet (0..n rows). Selecting all values means everyone. Owner-only.';

-- -----------------------------------------------------------------------------
-- Atomic replacement RPCs (SECURITY INVOKER)
-- -----------------------------------------------------------------------------

create or replace function public.replace_profile_interests(p_interest_ids uuid[])
returns setof public.profile_interests
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_interest_ids is null or array_position(p_interest_ids, null) is not null then
    raise exception 'interest ids must be a non-null array without nulls' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_interest_ids) as t(x);
  if cardinality(v_ids) > 10 then
    raise exception 'a profile can have at most 10 interests' using errcode = '23514';
  end if;

  delete from public.profile_interests pi
   where pi.user_id = v_user_id
     and not (pi.interest_id = any (v_ids));

  insert into public.profile_interests (user_id, interest_id)
  select v_user_id, x
    from unnest(v_ids) as t(x)
   where not exists (
     select 1 from public.profile_interests pi
      where pi.user_id = v_user_id and pi.interest_id = x
   );

  return query
    select pi.* from public.profile_interests pi where pi.user_id = v_user_id;
end;
$$;

comment on function public.replace_profile_interests(uuid[]) is
  'Atomically replaces the caller''s interest selections (max 10, active interests only).';

create or replace function public.set_discovery_gender_preferences(p_genders text[])
returns setof public.discovery_gender_preferences
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_genders text[];
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_genders is null or array_position(p_genders, null) is not null then
    raise exception 'genders must be a non-null array without nulls' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct g), '{}') into v_genders from unnest(p_genders) as t(g);

  delete from public.discovery_gender_preferences gp
   where gp.user_id = v_user_id
     and not (gp.gender = any (v_genders));

  insert into public.discovery_gender_preferences (user_id, gender)
  select v_user_id, g from unnest(v_genders) as t(g)
  on conflict (user_id, gender) do nothing;

  return query
    select gp.* from public.discovery_gender_preferences gp where gp.user_id = v_user_id;
end;
$$;

comment on function public.set_discovery_gender_preferences(text[]) is
  'Atomically replaces the caller''s gender preferences. Empty array clears them.';

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.profile_interests_before_insert() from public, anon, authenticated;
revoke all on function private.discovery_preferences_before_update() from public, anon, authenticated;
revoke all on function private.handle_new_profile() from public, anon, authenticated;

revoke all on function public.replace_profile_interests(uuid[]) from public, anon;
revoke all on function public.set_discovery_gender_preferences(text[]) from public, anon;
grant execute on function public.replace_profile_interests(uuid[]) to authenticated, service_role;
grant execute on function public.set_discovery_gender_preferences(text[]) to authenticated, service_role;

revoke all on table public.interests from public, anon, authenticated;
grant select on table public.interests to authenticated;
grant all on table public.interests to service_role;

revoke all on table public.profile_interests from public, anon, authenticated;
grant select, delete on table public.profile_interests to authenticated;
grant insert (user_id, interest_id) on table public.profile_interests to authenticated;
grant all on table public.profile_interests to service_role;

revoke all on table public.discovery_preferences from public, anon, authenticated;
grant select on table public.discovery_preferences to authenticated;
grant update (min_age, max_age, minimum_overlap_days, max_distance_km)
  on table public.discovery_preferences to authenticated;
grant all on table public.discovery_preferences to service_role;

revoke all on table public.discovery_gender_preferences from public, anon, authenticated;
grant select, delete on table public.discovery_gender_preferences to authenticated;
grant insert (user_id, gender) on table public.discovery_gender_preferences to authenticated;
grant all on table public.discovery_gender_preferences to service_role;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.discovery_preferences enable row level security;
alter table public.discovery_gender_preferences enable row level security;

create policy "interests_select_active"
  on public.interests for select to authenticated
  using (active);

create policy "profile_interests_select_own"
  on public.profile_interests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "profile_interests_insert_own"
  on public.profile_interests for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "profile_interests_delete_own"
  on public.profile_interests for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "discovery_preferences_select_own"
  on public.discovery_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "discovery_preferences_update_own"
  on public.discovery_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "discovery_gender_preferences_select_own"
  on public.discovery_gender_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "discovery_gender_preferences_insert_own"
  on public.discovery_gender_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "discovery_gender_preferences_delete_own"
  on public.discovery_gender_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);
