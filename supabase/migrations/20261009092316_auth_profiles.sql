-- =============================================================================
-- Triply · Phase 1M-B · Auth + profile domain
-- =============================================================================
--
-- Creates public.profiles: one row per auth.users row, holding user-facing
-- profile fields only. Identity, credentials and sessions stay in Supabase Auth
-- (auth.users); nothing here duplicates them.
--
-- Lifecycle
--   * AFTER INSERT on auth.users → private.handle_new_user() inserts
--     public.profiles(id) only. No auth metadata is trusted or copied.
--   * Deleting the auth user deletes the profile (FK on delete cascade).
--
-- Database-enforced rules (the app's client-side validation is UX only)
--   * date_of_birth is stored; age is never stored. A future date_of_birth is
--     rejected by trigger (a CHECK using current_date would not be re-evaluated
--     over time, so it is deliberately not used). Dates before 1900-01-01 are
--     rejected by an immutable CHECK.
--   * Adult = date_of_birth <= current_date - 18 years, evaluated in
--     private.is_adult() at write time. current_date uses the database time
--     zone (UTC on Supabase).
--   * is_profile_complete is computed by private.profile_is_complete() on every
--     insert/update: first_name (non-empty), date_of_birth, adult, gender.
--     Clients cannot write it (no column privilege; trigger overwrites it).
--   * is_discoverable is a user preference that can only be true while the
--     profile is complete (which implies 18+). Explicitly requesting it on an
--     incomplete profile raises an error; an edit that makes a discoverable
--     profile incomplete silently forces it back to false. A CHECK constraint
--     guarantees the invariant even for privileged writes.
--   * Text fields are trimmed; empty strings become NULL.
--   * Protected columns (id, created_at, updated_at, is_profile_complete) are
--     excluded from the authenticated role's column-level UPDATE grant and are
--     also normalised/rejected by trigger (defence in depth).
--
-- Access (RLS enabled below)
--   * authenticated: SELECT and UPDATE of their OWN row only.
--   * No INSERT or DELETE for clients (creation by auth trigger; deletion via
--     the future account-deletion flow).
--   * anon: no privileges at all.
--   * Discovery-safe reads of other users' profiles belong to a later phase and
--     must not be added by widening these policies.
--
-- Rollback / recovery (no down migrations; run manually only if required)
--   drop trigger if exists on_auth_user_created_create_profile on auth.users;
--   drop table if exists public.profiles;           -- destroys profile data
--   drop function if exists private.handle_new_user();
--   drop function if exists private.profiles_before_write();
--   drop function if exists private.profile_is_complete(text, date, text);
--   drop function if exists private.is_adult(date, date);
--   drop function if exists private.normalize_text(text);
--   Prefer a forward fix migration over rollback once real users exist.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Private helpers
-- -----------------------------------------------------------------------------

create or replace function private.normalize_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p_value, E' \t\n\r\f'), '');
$$;

comment on function private.normalize_text(text) is
  'Trims surrounding whitespace; empty strings become NULL.';

create or replace function private.is_adult(p_date_of_birth date, p_as_of date default current_date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_date_of_birth is not null
     and p_date_of_birth <= (p_as_of - interval '18 years')::date;
$$;

comment on function private.is_adult(date, date) is
  'True when the person is at least 18 on p_as_of (default: current_date, database time zone).';

create or replace function private.profile_is_complete(
  p_first_name text,
  p_date_of_birth date,
  p_gender text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.normalize_text(p_first_name), '') <> ''
     and p_gender is not null
     and private.is_adult(p_date_of_birth);
$$;

comment on function private.profile_is_complete(text, date, text) is
  'Phase 1M-B minimum completeness: first_name, date_of_birth, 18+, gender.';

-- -----------------------------------------------------------------------------
-- public.profiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  date_of_birth date,
  gender text,
  bio text,
  home_city text,
  home_country text,
  occupation text,
  is_profile_complete boolean not null default false,
  is_discoverable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_first_name_valid
    check (first_name is null or (char_length(first_name) between 1 and 80
           and first_name = btrim(first_name, E' \t\n\r\f'))),
  constraint profiles_bio_valid
    check (bio is null or (char_length(bio) between 1 and 1000
           and bio = btrim(bio, E' \t\n\r\f'))),
  constraint profiles_home_city_valid
    check (home_city is null or (char_length(home_city) between 1 and 120
           and home_city = btrim(home_city, E' \t\n\r\f'))),
  constraint profiles_home_country_valid
    check (home_country is null or (char_length(home_country) between 1 and 120
           and home_country = btrim(home_country, E' \t\n\r\f'))),
  constraint profiles_occupation_valid
    check (occupation is null or (char_length(occupation) between 1 and 120
           and occupation = btrim(occupation, E' \t\n\r\f'))),
  constraint profiles_gender_valid
    check (gender is null or gender in ('man', 'woman', 'non_binary', 'other', 'prefer_not_to_say')),
  constraint profiles_date_of_birth_plausible
    check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  constraint profiles_discoverable_requires_complete
    check (not is_discoverable or is_profile_complete)
);

comment on table public.profiles is
  'User-facing profile, 1:1 with auth.users. Created by auth trigger. Owner-only access in Phase 1M-B.';
comment on column public.profiles.gender is
  'One of: man, woman, non_binary, other, prefer_not_to_say (CHECK constraint, extend by migration).';
comment on column public.profiles.date_of_birth is
  'Stored instead of age. Must not be in the future (trigger). Adulthood evaluated by private.is_adult().';
comment on column public.profiles.is_profile_complete is
  'Database-maintained. Never writable by clients.';
comment on column public.profiles.is_discoverable is
  'User preference; only true while is_profile_complete (implies 18+).';

-- -----------------------------------------------------------------------------
-- Write normalisation + protected columns
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER so the private.* helpers can be called without granting the
-- client roles any access to the private schema. It reads no tables.
create or replace function private.profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discoverable_requested boolean;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'profiles.id cannot be changed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    v_discoverable_requested := new.is_discoverable and not old.is_discoverable;
  else
    new.created_at := now();
    new.updated_at := now();
    v_discoverable_requested := new.is_discoverable;
  end if;

  new.first_name   := private.normalize_text(new.first_name);
  new.bio          := private.normalize_text(new.bio);
  new.home_city    := private.normalize_text(new.home_city);
  new.home_country := private.normalize_text(new.home_country);
  new.occupation   := private.normalize_text(new.occupation);

  if new.date_of_birth is not null and new.date_of_birth > current_date then
    raise exception 'date_of_birth cannot be in the future' using errcode = '23514';
  end if;

  new.is_profile_complete :=
    private.profile_is_complete(new.first_name, new.date_of_birth, new.gender);

  if new.is_discoverable and not new.is_profile_complete then
    if v_discoverable_requested then
      raise exception 'profile must be complete (first name, date of birth, 18+, gender) before it can be discoverable'
        using errcode = '23514';
    end if;
    new.is_discoverable := false;
  end if;

  return new;
end;
$$;

comment on function private.profiles_before_write() is
  'BEFORE INSERT/UPDATE on public.profiles: protects canonical columns, normalises text, enforces DOB/completeness/discoverability rules.';

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- auth.users → public.profiles
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER because the inserting role is Supabase Auth's internal role,
-- which has no privileges on public.profiles. Inserts only the id; idempotent.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function private.handle_new_user() is
  'AFTER INSERT on auth.users: creates the matching public.profiles row (id only).';

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.normalize_text(text) from public, anon, authenticated;
revoke all on function private.is_adult(date, date) from public, anon, authenticated;
revoke all on function private.profile_is_complete(text, date, text) from public, anon, authenticated;
revoke all on function private.profiles_before_write() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (
  first_name,
  date_of_birth,
  gender,
  bio,
  home_city,
  home_country,
  occupation,
  is_discoverable
) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Intentionally no INSERT or DELETE policies.
