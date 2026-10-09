-- =============================================================================
-- Triply · Phase 1M-E · Decisions + matching
-- =============================================================================
--
-- Tables
--   public.user_decisions  one current like/pass per directed pair (actor → target)
--   public.matches         one canonical row per unordered pair, forever
--
-- Write path (RPC only — clients have NO insert/update/delete on either table)
--   public.submit_decision(target, decision, source_trip?, target_trip?)
--     * actor is always auth.uid(); never accepted from the caller
--     * upserts the actor's decision for the pair
--     * if decision = like AND the reverse decision is like AND the pair has no
--       match row yet → creates the canonical match in the same transaction
--     * returns { decision_id, decision, matched, match_id, match_created }
--       and nothing about the other user's decision unless a match now exists
--   public.unmatch(match_id)
--     * participant only; sets unmatched_at/unmatched_by once (idempotent)
--
-- Privacy (critical)
--   * A user can SELECT only decisions they made (actor). Rows where they are
--     only the target are invisible, so "who liked me" cannot be queried.
--   * The reverse-like check runs only inside submit_decision (SECURITY
--     DEFINER) and its result is never returned unless it produced a match.
--   * Matches are visible only to their two participants.
--
-- Decision change rules
--   * Before a match: like ↔ pass changes update the same row.
--   * With an active match: changing the decision does NOT unmatch (unmatch is
--     always explicit); matched=true is returned because the match still exists.
--   * After unmatch: decisions may change but never recreate the match.
--
-- Matches
--   * Canonical pair: user_low_id < user_high_id (UUID ordering), unique pair.
--   * Unmatch is TERMINAL in this phase: the pair keeps its single row with
--     unmatched_at set; submit_decision never inserts a second row and never
--     clears unmatched_at (a trigger also forbids reopening). Rematching needs
--     explicit future product logic.
--
-- Concurrency
--   submit_decision takes a transaction-scoped advisory lock on the unordered
--   pair, so two simultaneous mutual likes are serialised: the second call sees
--   the first call's committed like and creates the match. The unique
--   constraints (actor,target) and (user_low_id,user_high_id) plus ON CONFLICT
--   are the final guarantee against duplicates. One lock per call → no
--   lock-ordering deadlocks.
--
-- Trip context (optional)
--   source_trip_id must be the actor's own non-cancelled trip; target_trip_id
--   must be the target's non-cancelled trip. Context only — eligibility and
--   date overlap belong to the future discovery RPC.
--
-- Indexes
--   user_decisions_actor_target_key (unique)  own decisions + the reverse-like
--                                             lookup (actor=target, target=actor)
--   user_decisions_target_user_id_idx         FK cascade when a target is deleted
--   matches_pair_key (unique)                 pair lookups; covers user_low_id
--   matches_user_high_id_idx                  "my matches" for the high side + FK
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   drop function if exists public.unmatch(uuid);
--   drop function if exists public.submit_decision(uuid, text, uuid, uuid);
--   drop table if exists public.matches, public.user_decisions;
--   drop function if exists private.user_decisions_before_update(),
--     private.matches_before_update();
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.user_decisions
-- -----------------------------------------------------------------------------

create table public.user_decisions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  decision text not null,
  source_trip_id uuid references public.trips (id) on delete set null,
  target_trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_decisions_actor_target_key unique (actor_user_id, target_user_id),
  constraint user_decisions_not_self check (actor_user_id <> target_user_id),
  constraint user_decisions_decision_valid check (decision in ('like', 'pass'))
);

comment on table public.user_decisions is
  'One current like/pass per directed pair. Written only by submit_decision(); readable only by the actor.';

create index user_decisions_target_user_id_idx on public.user_decisions (target_user_id);

create or replace function private.user_decisions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.actor_user_id is distinct from old.actor_user_id
     or new.target_user_id is distinct from old.target_user_id then
    raise exception 'decision pair cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger user_decisions_before_update
  before update on public.user_decisions
  for each row execute function private.user_decisions_before_update();

create trigger set_updated_at
  before update on public.user_decisions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- public.matches
-- -----------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles (id) on delete cascade,
  user_high_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unmatched_by uuid references public.profiles (id) on delete set null,

  constraint matches_pair_key unique (user_low_id, user_high_id),
  constraint matches_canonical_order check (user_low_id < user_high_id),
  constraint matches_unmatched_by_participant
    check (unmatched_by is null or unmatched_by in (user_low_id, user_high_id)),
  constraint matches_unmatched_by_requires_unmatched_at
    check (unmatched_by is null or unmatched_at is not null)
);

comment on table public.matches is
  'One canonical row per pair (user_low_id < user_high_id). Created only by submit_decision(); unmatch is terminal.';

create index matches_user_high_id_idx on public.matches (user_high_id);

create or replace function private.matches_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_low_id is distinct from old.user_low_id
     or new.user_high_id is distinct from old.user_high_id then
    raise exception 'match participants cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  if old.unmatched_at is not null
     and (new.unmatched_at is distinct from old.unmatched_at
          or new.unmatched_by is distinct from old.unmatched_by) then
    raise exception 'an unmatched match cannot be reopened or changed' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger matches_before_update
  before update on public.matches
  for each row execute function private.matches_before_update();

-- -----------------------------------------------------------------------------
-- RPC: submit_decision
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER is required: the function must read the reverse decision
-- (hidden from the caller by RLS) and insert into matches (no client grant).
-- It trusts only auth.uid() and returns no information about the other user's
-- decision unless a match exists.
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

  -- Serialise all decisions for this unordered pair (see header: concurrency).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.decision_pair:' || v_low::text || ':' || v_high::text, 0)
  );

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
  'Records the caller''s like/pass for a user and atomically creates the canonical match on a mutual like. Never reveals the other user''s decision.';

-- -----------------------------------------------------------------------------
-- RPC: unmatch
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER: clients have no UPDATE privilege on matches. Only a
-- participant can unmatch; non-participants get "not found" (no existence leak).
create or replace function public.unmatch(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_match public.matches;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.matches m
     set unmatched_at = now(),
         unmatched_by = v_actor
   where m.id = p_match_id
     and v_actor in (m.user_low_id, m.user_high_id)
     and m.unmatched_at is null;

  select m.* into v_match
    from public.matches m
   where m.id = p_match_id and v_actor in (m.user_low_id, m.user_high_id);

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  return v_match;
end;
$$;

comment on function public.unmatch(uuid) is
  'Participant-only, idempotent, terminal unmatch. Returns the match row.';

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.user_decisions_before_update() from public, anon, authenticated;
revoke all on function private.matches_before_update() from public, anon, authenticated;

revoke all on function public.submit_decision(uuid, text, uuid, uuid) from public, anon;
revoke all on function public.unmatch(uuid) from public, anon;
grant execute on function public.submit_decision(uuid, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.unmatch(uuid) to authenticated, service_role;

revoke all on table public.user_decisions from public, anon, authenticated;
grant select on table public.user_decisions to authenticated;
grant all on table public.user_decisions to service_role;

revoke all on table public.matches from public, anon, authenticated;
grant select on table public.matches to authenticated;
grant all on table public.matches to service_role;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.user_decisions enable row level security;
alter table public.matches enable row level security;

-- Outgoing decisions only. There is deliberately no policy on target_user_id.
create policy "user_decisions_select_own_outgoing"
  on public.user_decisions for select to authenticated
  using ((select auth.uid()) = actor_user_id);

create policy "matches_select_participant"
  on public.matches for select to authenticated
  using ((select auth.uid()) = user_low_id or (select auth.uid()) = user_high_id);

-- Intentionally no INSERT/UPDATE/DELETE policies: all writes go through the RPCs.
