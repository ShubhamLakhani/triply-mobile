-- =============================================================================
-- Triply · Phase 1M-A · Foundation migration
-- =============================================================================
--
-- Purpose
--   Establish shared database infrastructure that every later migration builds
--   on. This migration intentionally creates NO product tables.
--
-- Contents
--   1. `private` schema — internal helpers that must never be reachable through
--      the Supabase Data API (PostgREST only exposes the schemas listed in
--      supabase/config.toml → [api].schemas, which does not include `private`).
--   2. private.set_updated_at() — generic BEFORE UPDATE trigger function that
--      maintains an `updated_at timestamptz` column.
--
-- Extensions
--   None. gen_random_uuid() is built into PostgreSQL 13+, so no uuid extension
--   is required. Add extensions only in the migration that first needs them,
--   created `with schema extensions`.
--
-- Conventions for ALL future migrations (see supabase/README.md for detail)
--   * Files are created with `npx supabase migration new <snake_case_name>`
--     (timestamped). Never edit a migration that has been applied to a shared
--     environment; write a new migration instead.
--   * snake_case identifiers; plural table names (e.g. public.trips).
--   * App-domain primary keys: `id uuid primary key default gen_random_uuid()`.
--   * Timestamps: `timestamptz` (`created_at ... not null default now()`,
--     `updated_at ... not null default now()` + private.set_updated_at trigger).
--   * Travel dates: `date` (never timestamptz) with explicit check constraints,
--     e.g. `check (end_date >= start_date)`.
--   * Explicit constraints: not null, check, unique, foreign keys with an
--     explicit `on delete` behaviour.
--   * RLS: `alter table ... enable row level security` in the SAME migration
--     that creates any table in an exposed schema, together with its policies.
--   * Sensitive operations go through RPC / Edge Functions, not direct writes.
--   * Functions: `set search_path = ''` and fully-qualified names.
--   * No manual schema changes in staging/production. Migrations only.
--
-- Rollback (Supabase CLI has no down migrations; reverse manually if needed):
--   drop function if exists private.set_updated_at();
--   drop schema if exists private;
-- =============================================================================

create schema if not exists private;

comment on schema private is
  'Triply internal helpers. Not exposed via the Data API. Do not add to [api].schemas.';

-- Client roles get nothing in this schema. Grant narrowly, per object, only if a
-- future RLS policy genuinely needs to call a helper from here.
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- -----------------------------------------------------------------------------
-- private.set_updated_at()
--
-- Usage (in the migration that creates a table with an updated_at column):
--
--   create trigger set_updated_at
--     before update on public.<table>
--     for each row execute function private.set_updated_at();
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function private.set_updated_at() is
  'BEFORE UPDATE trigger: sets NEW.updated_at to now(). Requires an updated_at timestamptz column.';

revoke all on function private.set_updated_at() from public;
revoke all on function private.set_updated_at() from anon, authenticated;
