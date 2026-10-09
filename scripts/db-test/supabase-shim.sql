-- =============================================================================
-- Minimal Supabase platform emulation for running migrations + pgTAP tests on
-- a PLAIN PostgreSQL server (used by scripts/db-test/run.sh when Docker /
-- the local Supabase stack is unavailable).
--
-- NOT a migration. Never run against a Supabase project. It recreates only the
-- pieces our migrations and tests depend on, mirroring Supabase defaults:
--   * roles anon / authenticated / service_role (+ supabase_auth_admin)
--   * schema auth with a reduced auth.users table and auth.uid()
--   * schema extensions (pgtap installed there)
--   * Supabase's default privileges on schema public (grant all to API roles),
--     so tests prove our migrations' explicit REVOKEs actually take effect.
-- The real local stack (`npx supabase test db`) remains the authoritative check.
-- =============================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_auth_admin nologin noinherit;

create schema auth authorization supabase_auth_admin;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table auth.users owner to supabase_auth_admin;

-- Same resolution order as Supabase's auth.uid().
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension pgtap with schema extensions;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
