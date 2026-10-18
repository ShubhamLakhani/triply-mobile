-- =============================================================================
-- Triply · Pre-3M · M-02 · Account states
-- =============================================================================
--
-- First-class, server-enforced account status (decision pass, topic 6). One row
-- per auth user, created by trigger and backfilled below.
--
-- public.account_states
--   status             active | suspended | banned | deletion_pending
--   safety_hold_at     internal moderation hold. SEPARATE from status and never
--                      exposed to the user (the hold is silent). No automatic
--                      hold rules exist yet; moderation tooling sets it later.
--   reason_code        internal snake_case code for the current status/hold.
--   status_changed_at  maintained by trigger whenever status changes.
--   suspended_until    optional end of a suspension (only while suspended). A
--                      suspension whose end has passed counts as active at read
--                      time (private.effective_account_status), so no job is
--                      needed to lift it.
--
-- Access
--   * No client table privileges at all (RLS on, no policies). The mobile app
--     reads its own state through public.get_my_account_state(), which returns
--     only the effective status and suspended_until (never the hold or reason).
--   * Writes: migrations / service_role / future moderation RPCs only. The app
--     never ships a service_role key.
--
-- Enforcement helpers (reuse in every future write RPC)
--   private.account_is_active(uid)  true only for an existing row whose effective
--                                   status is 'active'. A missing row is NOT
--                                   active (fail closed).
--   private.assert_active_actor()   returns auth.uid(); raises 42501 'not
--                                   authenticated' without a user, and SQLSTATE
--                                   TR001 'account inactive' for any non-active
--                                   account. Mobile maps TR001 to account_inactive.
--   The safety hold does not make an account inactive: it will only remove the
--   user from discovery/matching (Phase 4M), silently.
--
--   This migration adds no call sites; M-03 (profile/onboarding model) wires
--   the helper into the profile, preference, interest and photo write paths.
--   Decisions/blocks/reports are left unchanged until their own phases (block
--   and report must stay available to suspended users; submit_decision is
--   rewritten in Phase 4M).
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   drop trigger if exists on_auth_user_created_create_account_state on auth.users;
--   drop function if exists public.get_my_account_state();
--   drop function if exists private.assert_active_actor();
--   drop function if exists private.account_is_active(uuid);
--   drop function if exists private.effective_account_status(text, timestamptz);
--   drop function if exists private.handle_new_account_state();
--   drop function if exists private.account_states_before_update();
--   drop table if exists public.account_states;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.account_states
-- -----------------------------------------------------------------------------

create table public.account_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active',
  safety_hold_at timestamptz,
  reason_code text,
  status_changed_at timestamptz not null default now(),
  suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint account_states_status_valid
    check (status in ('active', 'suspended', 'banned', 'deletion_pending')),
  constraint account_states_reason_code_format
    check (reason_code is null or (char_length(reason_code) between 2 and 60
           and reason_code ~ '^[a-z0-9]+(_[a-z0-9]+)*$')),
  constraint account_states_suspended_until_requires_suspended
    check (suspended_until is null or status = 'suspended')
);

comment on table public.account_states is
  'Server-owned account status (1:1 with auth.users). No client access; own effective status via get_my_account_state().';
comment on column public.account_states.safety_hold_at is
  'Internal moderation hold, separate from status. Never exposed to the user.';
comment on column public.account_states.suspended_until is
  'Optional end of a suspension. Once passed, the effective status is active.';

create or replace function private.account_states_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'account state owner cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;
  return new;
end;
$$;

comment on function private.account_states_before_update() is
  'BEFORE UPDATE on public.account_states: owner immutable, created_at preserved, status_changed_at maintained.';

create trigger account_states_before_update
  before update on public.account_states
  for each row execute function private.account_states_before_update();

create trigger set_updated_at
  before update on public.account_states
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- auth.users → public.account_states (+ backfill)
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: the inserting role is Supabase Auth's internal role. Idempotent.
create or replace function private.handle_new_account_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_states (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function private.handle_new_account_state() is
  'AFTER INSERT on auth.users: creates the active account_states row.';

create trigger on_auth_user_created_create_account_state
  after insert on auth.users
  for each row execute function private.handle_new_account_state();

insert into public.account_states (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function private.effective_account_status(
  p_status text,
  p_suspended_until timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'suspended' and p_suspended_until is not null and p_suspended_until <= now()
      then 'active'
    else p_status
  end;
$$;

comment on function private.effective_account_status(text, timestamptz) is
  'Status as it applies now: a suspension whose suspended_until has passed is active.';

-- SECURITY DEFINER so it can be called from any server-side context; it is not
-- executable by client roles (it takes an arbitrary user id).
create or replace function private.account_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_states s
     where s.user_id = p_user_id
       and private.effective_account_status(s.status, s.suspended_until) = 'active'
  );
$$;

comment on function private.account_is_active(uuid) is
  'True only when the user has an account_states row whose effective status is active (missing row = inactive).';

create or replace function private.assert_active_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.account_is_active(v_actor) then
    raise exception 'account inactive' using errcode = 'TR001';
  end if;
  return v_actor;
end;
$$;

comment on function private.assert_active_actor() is
  'Returns auth.uid() for an active account; raises 42501 (no user) or TR001 (account inactive). Call first in every write RPC.';

-- -----------------------------------------------------------------------------
-- RPC: get_my_account_state (own effective status only)
-- -----------------------------------------------------------------------------

create or replace function public.get_my_account_state()
returns table (status text, suspended_until timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
    select private.effective_account_status(s.status, s.suspended_until),
           case when private.effective_account_status(s.status, s.suspended_until) = 'suspended'
                then s.suspended_until end
      from public.account_states s
     where s.user_id = v_actor;

  if not found then
    raise exception 'account state not found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.get_my_account_state() is
  'The caller''s effective account status (+ suspension end). Never returns the safety hold or reason.';

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.account_states_before_update() from public, anon, authenticated;
revoke all on function private.handle_new_account_state() from public, anon, authenticated;
revoke all on function private.effective_account_status(text, timestamptz) from public, anon, authenticated;
revoke all on function private.account_is_active(uuid) from public, anon, authenticated;
revoke all on function private.assert_active_actor() from public, anon, authenticated;

revoke all on function public.get_my_account_state() from public, anon;
grant execute on function public.get_my_account_state() to authenticated, service_role;

revoke all on table public.account_states from public, anon, authenticated;
grant all on table public.account_states to service_role;

-- -----------------------------------------------------------------------------
-- Row level security (no client policies: the table is server-owned)
-- -----------------------------------------------------------------------------

alter table public.account_states enable row level security;
