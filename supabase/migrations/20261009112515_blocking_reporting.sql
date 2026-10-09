-- =============================================================================
-- Triply · Phase 1M-F · Blocking + reporting
-- =============================================================================
--
-- Tables
--   public.user_blocks   one directed block per (blocker → blocked) pair
--   public.user_reports  moderation records (append-only for clients)
--
-- Write path (RPC only — clients have NO insert/update/delete on either table)
--   public.block_user(target)    idempotent; atomically terminates an active
--                                match for the pair (unmatched_by = blocker)
--   public.unblock_user(target)  removes only the caller's own directed block;
--                                idempotent; restores nothing
--   public.report_user(...)      validated report; status always 'open'
--   public.submit_decision(...)  REPLACED: rejects any decision while either
--                                direction of the pair is blocked
--
-- Block privacy (critical)
--   * A user can SELECT only blocks they created (blocker). Rows where they are
--     the blocked user are invisible; there is no reverse lookup anywhere.
--   * submit_decision rejects a blocked pair with ONE generic error
--     ('interaction unavailable', 42501) regardless of which side blocked.
--   * A block-terminated match looks exactly like an ordinary unmatch by the
--     blocker (unmatched_at + unmatched_by), so the other participant cannot
--     tell a block from an unmatch.
--   * report_user never consults blocks, so it cannot be used as a block oracle.
--
-- Report privacy (critical)
--   * Only the reporter can read their own reports, and only the submitted
--     content columns — NOT status (moderation outcome is not revealed).
--   * The reported user has no policy and therefore never sees report rows.
--   * status is server/admin controlled (service_role only); reports are
--     content-immutable even for privileged writes (evidence integrity).
--
-- Unblock semantics
--   * Deletes only the caller's row. Never reopens a match (unmatch remains
--     terminal from Phase 1M-E), never creates a match, never touches reports
--     or decisions. Future decisions become possible again; a new match can
--     only arise from a later submit_decision call on a pair with no match row.
--
-- Concurrency
--   block_user takes the SAME transaction-scoped advisory lock on the unordered
--   pair as submit_decision ('triply.decision_pair:<low>:<high>'). Therefore:
--     * block commits first  → submit_decision sees the block and rejects;
--     * like commits first   → block_user sees the new match and terminates it
--                              in its own transaction.
--   Either way no active match survives a committed block. Duplicate blocks
--   are absorbed by the primary key + ON CONFLICT DO NOTHING.
--
-- Indexes
--   user_blocks_pkey (blocker, blocked)       own block list + pair checks
--   user_blocks_blocked_user_id_idx           internal reverse check + FK cascade
--   user_reports_reporter_created_idx         reporter history (newest first)
--   user_reports_reported_created_idx         future moderation queue per user
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   -- restore the Phase 1M-E submit_decision body from 20261009110512 first
--   drop function if exists public.report_user(uuid, text, text, uuid, uuid);
--   drop function if exists public.unblock_user(uuid);
--   drop function if exists public.block_user(uuid);
--   drop table if exists public.user_reports, public.user_blocks;
--   drop function if exists private.user_reports_before_update();
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.user_blocks
-- -----------------------------------------------------------------------------

create table public.user_blocks (
  blocker_user_id uuid not null references public.profiles (id) on delete cascade,
  blocked_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint user_blocks_pkey primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_not_self check (blocker_user_id <> blocked_user_id)
);

comment on table public.user_blocks is
  'Directed blocks. Written only by block_user()/unblock_user(); readable only by the blocker. No reason is stored here.';

create index user_blocks_blocked_user_id_idx on public.user_blocks (blocked_user_id);

-- -----------------------------------------------------------------------------
-- public.user_reports
-- -----------------------------------------------------------------------------

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  related_match_id uuid references public.matches (id) on delete set null,
  related_trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'open',

  constraint user_reports_not_self check (reporter_user_id <> reported_user_id),
  constraint user_reports_reason_valid check (
    reason in (
      'harassment', 'spam', 'scam', 'inappropriate_content', 'impersonation',
      'underage_concern', 'safety_concern', 'other'
    )
  ),
  constraint user_reports_details_length check (
    details is null or char_length(details) between 1 and 2000
  ),
  constraint user_reports_status_valid check (
    status in ('open', 'reviewed', 'actioned', 'dismissed')
  )
);

comment on table public.user_reports is
  'Moderation records. Created only by report_user(); reporter may read own submitted content (not status); reported user never sees rows; status is service/admin controlled.';

create index user_reports_reporter_created_idx
  on public.user_reports (reporter_user_id, created_at desc);
create index user_reports_reported_created_idx
  on public.user_reports (reported_user_id, created_at desc);

-- Reports are evidence: only status may change after creation (service_role /
-- future moderation tooling). Content columns are immutable for everyone.
create or replace function private.user_reports_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.reporter_user_id is distinct from old.reporter_user_id
     or new.reported_user_id is distinct from old.reported_user_id
     or new.reason is distinct from old.reason
     or new.details is distinct from old.details
     or new.created_at is distinct from old.created_at then
    raise exception 'report content cannot be changed' using errcode = '42501';
  end if;
  -- related_match_id / related_trip_id may only be cleared by FK ON DELETE SET NULL.
  if (new.related_match_id is distinct from old.related_match_id and new.related_match_id is not null)
     or (new.related_trip_id is distinct from old.related_trip_id and new.related_trip_id is not null) then
    raise exception 'report content cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger user_reports_before_update
  before update on public.user_reports
  for each row execute function private.user_reports_before_update();

-- -----------------------------------------------------------------------------
-- RPC: block_user
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: clients have no write privilege on user_blocks/matches.
-- Blocker is always auth.uid(). Returns only the caller's own block row.
create or replace function public.block_user(p_target_user_id uuid)
returns table (blocked_user_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'target user is required' using errcode = '22023';
  end if;
  if p_target_user_id = v_actor then
    raise exception 'cannot block yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  v_low := least(v_actor, p_target_user_id);
  v_high := greatest(v_actor, p_target_user_id);

  -- Same pair lock as submit_decision (see header: concurrency).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.decision_pair:' || v_low::text || ':' || v_high::text, 0)
  );

  insert into public.user_blocks (blocker_user_id, blocked_user_id)
  values (v_actor, p_target_user_id)
  on conflict (blocker_user_id, blocked_user_id) do nothing;

  -- Terminate an active match with the existing terminal-unmatch semantics.
  -- Already-unmatched rows are left untouched (history preserved).
  update public.matches m
     set unmatched_at = now(),
         unmatched_by = v_actor
   where m.user_low_id = v_low
     and m.user_high_id = v_high
     and m.unmatched_at is null;

  return query
    select b.blocked_user_id, b.created_at
      from public.user_blocks b
     where b.blocker_user_id = v_actor and b.blocked_user_id = p_target_user_id;
end;
$$;

comment on function public.block_user(uuid) is
  'Idempotently blocks a user for the caller and atomically ends any active match for the pair. Never reveals the other user''s block state.';

-- -----------------------------------------------------------------------------
-- RPC: unblock_user
-- -----------------------------------------------------------------------------

-- Removes only the caller's own directed block. Returns whether a row was
-- removed (the caller's own state only). Restores no match and creates none.
create or replace function public.unblock_user(p_target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_removed integer;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_target_user_id = v_actor then
    raise exception 'invalid target user' using errcode = '22023';
  end if;

  delete from public.user_blocks b
   where b.blocker_user_id = v_actor and b.blocked_user_id = p_target_user_id;
  get diagnostics v_removed = row_count;

  return v_removed > 0;
end;
$$;

comment on function public.unblock_user(uuid) is
  'Idempotently removes the caller''s own block. Does not restore or create matches.';

-- -----------------------------------------------------------------------------
-- RPC: report_user
-- -----------------------------------------------------------------------------

-- Reporter is always auth.uid(); status is never accepted (defaults to 'open').
-- Deliberately independent of block state (no block oracle; a blocked or
-- blocking user must still be able to report). Multiple reports against the
-- same user are allowed (separate incidents, moderation history).
create or replace function public.report_user(
  p_reported_user_id uuid,
  p_reason text,
  p_details text default null,
  p_related_match_id uuid default null,
  p_related_trip_id uuid default null
)
returns table (report_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_details text := nullif(btrim(p_details), '');
  v_report_id uuid;
  v_created_at timestamptz;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_reported_user_id is null or p_reason is null or p_reason not in (
    'harassment', 'spam', 'scam', 'inappropriate_content', 'impersonation',
    'underage_concern', 'safety_concern', 'other'
  ) then
    raise exception 'a valid reason and reported user are required' using errcode = '22023';
  end if;
  if p_reported_user_id = v_actor then
    raise exception 'cannot report yourself' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 2000 then
    raise exception 'details must be at most 2000 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_reported_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  -- Related match: must be the pair's own match (active or unmatched).
  if p_related_match_id is not null and not exists (
    select 1 from public.matches m
     where m.id = p_related_match_id
       and m.user_low_id = least(v_actor, p_reported_user_id)
       and m.user_high_id = greatest(v_actor, p_reported_user_id)
  ) then
    raise exception 'invalid report context' using errcode = '22023';
  end if;
  -- Related trip: must belong to the reporter or the reported user (any status).
  if p_related_trip_id is not null and not exists (
    select 1 from public.trips t
     where t.id = p_related_trip_id and t.user_id in (v_actor, p_reported_user_id)
  ) then
    raise exception 'invalid report context' using errcode = '22023';
  end if;

  insert into public.user_reports as r
    (reporter_user_id, reported_user_id, reason, details, related_match_id, related_trip_id)
  values (v_actor, p_reported_user_id, p_reason, v_details, p_related_match_id, p_related_trip_id)
  returning r.id, r.created_at into v_report_id, v_created_at;

  return query select v_report_id, v_created_at;
end;
$$;

comment on function public.report_user(uuid, text, text, uuid, uuid) is
  'Files a moderation report as the caller. Status is always open; never reveals anything about the reported user.';

-- -----------------------------------------------------------------------------
-- RPC: submit_decision (REPLACED — adds the block guard; otherwise identical
-- to Phase 1M-E 20261009110512_decisions_matching.sql)
-- -----------------------------------------------------------------------------

create or replace function public.submit_decision(
  p_target_user_id uuid,
  p_decision text,
  p_source_trip_id uuid default null,
  p_target_trip_id uuid default null
)
returns table (
  decision_id uuid,
  decision text,
  matched boolean,
  match_id uuid,
  match_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_decision_id uuid;
  v_match_id uuid;
  v_match_active boolean;
  v_matched boolean := false;
  v_match_created boolean := false;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_decision is null or p_decision not in ('like', 'pass') then
    raise exception 'decision must be like or pass for a target user' using errcode = '22023';
  end if;
  if p_target_user_id = v_actor then
    raise exception 'cannot make a decision about yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if p_source_trip_id is not null and not exists (
    select 1 from public.trips t
     where t.id = p_source_trip_id and t.user_id = v_actor and t.status <> 'cancelled'
  ) then
    raise exception 'invalid trip context' using errcode = '22023';
  end if;
  if p_target_trip_id is not null and not exists (
    select 1 from public.trips t
     where t.id = p_target_trip_id and t.user_id = p_target_user_id and t.status <> 'cancelled'
  ) then
    raise exception 'invalid trip context' using errcode = '22023';
  end if;

  v_low := least(v_actor, p_target_user_id);
  v_high := greatest(v_actor, p_target_user_id);

  -- Serialise all decisions AND blocks for this unordered pair.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.decision_pair:' || v_low::text || ':' || v_high::text, 0)
  );

  -- Block guard (either direction). Checked under the pair lock, before any
  -- write. One generic error: the caller cannot learn which side blocked.
  if exists (
    select 1 from public.user_blocks b
     where (b.blocker_user_id = v_actor and b.blocked_user_id = p_target_user_id)
        or (b.blocker_user_id = p_target_user_id and b.blocked_user_id = v_actor)
  ) then
    raise exception 'interaction unavailable' using errcode = '42501';
  end if;

  insert into public.user_decisions as d
    (actor_user_id, target_user_id, decision, source_trip_id, target_trip_id)
  values (v_actor, p_target_user_id, p_decision, p_source_trip_id, p_target_trip_id)
  on conflict (actor_user_id, target_user_id) do update
    set decision = excluded.decision,
        source_trip_id = coalesce(excluded.source_trip_id, d.source_trip_id),
        target_trip_id = coalesce(excluded.target_trip_id, d.target_trip_id)
  returning d.id into v_decision_id;

  select m.id, m.unmatched_at is null
    into v_match_id, v_match_active
    from public.matches m
   where m.user_low_id = v_low and m.user_high_id = v_high;

  if found then
    -- Existing pair row: never reopen an unmatched match; never unmatch implicitly.
    v_matched := v_match_active;
    if not v_match_active then
      v_match_id := null;
    end if;
  elsif p_decision = 'like' and exists (
    select 1 from public.user_decisions r
     where r.actor_user_id = p_target_user_id
       and r.target_user_id = v_actor
       and r.decision = 'like'
  ) then
    insert into public.matches as m (user_low_id, user_high_id)
    values (v_low, v_high)
    on conflict (user_low_id, user_high_id) do nothing
    returning m.id into v_match_id;

    if v_match_id is not null then
      v_matched := true;
      v_match_created := true;
    else
      select m.id into v_match_id
        from public.matches m
       where m.user_low_id = v_low and m.user_high_id = v_high and m.unmatched_at is null;
      v_matched := v_match_id is not null;
    end if;
  end if;

  return query select v_decision_id, p_decision, v_matched, v_match_id, v_match_created;
end;
$$;

comment on function public.submit_decision(uuid, text, uuid, uuid) is
  'Records the caller''s like/pass and atomically creates the canonical match on a mutual like. Rejects blocked pairs generically. Never reveals the other user''s decision or block state.';

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.user_reports_before_update() from public, anon, authenticated;

revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.report_user(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.report_user(uuid, text, text, uuid, uuid) to authenticated;
-- submit_decision keeps its Phase 1M-E grants (CREATE OR REPLACE preserves them).

revoke all on table public.user_blocks from public, anon, authenticated;
grant select on table public.user_blocks to authenticated;
grant all on table public.user_blocks to service_role;

-- Column-level read grant: the reporter can see what they submitted, never the
-- moderation status.
revoke all on table public.user_reports from public, anon, authenticated;
grant select (
  id, reporter_user_id, reported_user_id, reason, details,
  related_match_id, related_trip_id, created_at
) on table public.user_reports to authenticated;
grant all on table public.user_reports to service_role;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

-- Outgoing blocks only. There is deliberately no policy on blocked_user_id.
create policy "user_blocks_select_own_outgoing"
  on public.user_blocks for select to authenticated
  using ((select auth.uid()) = blocker_user_id);

-- Own submitted reports only. There is deliberately no policy on reported_user_id.
create policy "user_reports_select_own_submitted"
  on public.user_reports for select to authenticated
  using ((select auth.uid()) = reporter_user_id);

-- Intentionally no INSERT/UPDATE/DELETE policies: all writes go through the RPCs
-- (or service_role for moderation status in a later phase).
