-- =============================================================================
-- Triply · Phase 1M-H · Security + RLS hardening
-- =============================================================================
--
-- Outcome of the Phase 1M-H audit (see SECURITY.md → Findings). Only real gaps
-- are fixed here; everything else passed the audit unchanged.
--
-- H-1 (medium, safety): submit_decision accepted likes from and to INCOMPLETE
--     profiles. Completeness is the database's 18+ gate (private.profile_is_complete),
--     so an under-18 account that knew a user's id could like and be matched.
--     Fix: the actor must have a complete profile ('complete your profile first',
--     42501, about the caller's own state); an incomplete target gets the same
--     generic 'interaction unavailable' (42501) used for blocks. block_user and
--     report_user deliberately stay open to every signed-in user.
--
-- H-2 (low, integrity/availability): replace_profile_interests could fail with a
--     duplicate-key error when the same user's calls overlapped, and
--     set_discovery_gender_preferences could leave the union of two concurrently
--     requested sets. Fix: both take a per-user transaction advisory lock first
--     (interests reuse the max-10 trigger's key); the interest insert also uses
--     ON CONFLICT DO NOTHING.
--
-- All three functions keep their signatures, so CREATE OR REPLACE preserves the
-- existing grants (authenticated + service_role execute; anon/PUBLIC revoked).
-- Bodies are otherwise identical to the versions in 20261009112515 /
-- 20261009103602.
--
-- Data note: existing matches/decisions involving incomplete profiles are not
-- modified. Check before production with:
--   select m.id from public.matches m
--     join public.profiles a on a.id = m.user_low_id
--     join public.profiles b on b.id = m.user_high_id
--    where not (a.is_profile_complete and b.is_profile_complete);
--
-- Rollback: re-run the function definitions from 20261009112515 (submit_decision)
-- and 20261009103602 (replace_profile_interests, set_discovery_gender_preferences).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- H-1: submit_decision — complete (18+) profiles only
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
  -- 1M-H: only complete (therefore 18+) profiles may like/pass.
  if not exists (
    select 1 from public.profiles p where p.id = v_actor and p.is_profile_complete
  ) then
    raise exception 'complete your profile first' using errcode = '42501';
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
  -- 1M-H: an incomplete (possibly under-18) target can never be liked or matched. Same
  -- generic error as a block so neither state is revealed.
  if not exists (
    select 1 from public.profiles p where p.id = p_target_user_id and p.is_profile_complete
  ) then
    raise exception 'interaction unavailable' using errcode = '42501';
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
  'Records the caller''s like/pass and atomically creates the canonical match on a mutual like. Both profiles must be complete (18+). Rejects blocked pairs and incomplete targets generically. Never reveals the other user''s decision or block state.';

-- -----------------------------------------------------------------------------
-- H-2: per-user serialisation of the replacement RPCs (SECURITY INVOKER, RLS applies)
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

  -- 1M-H: serialise replacements per user (same key as the max-10 insert trigger) so
  -- concurrent calls apply one after the other instead of failing on duplicates.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.profile_interests:' || v_user_id::text, 0)
  );

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
   )
  on conflict (user_id, interest_id) do nothing;

  return query
    select pi.* from public.profile_interests pi where pi.user_id = v_user_id;
end;
$$;

comment on function public.replace_profile_interests(uuid[]) is
  'Atomically replaces the caller''s interest selections (max 10, active interests only). Serialised per user.';

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

  -- 1M-H: serialise replacements per user so concurrent calls cannot leave the union
  -- of two requested sets.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.discovery_gender_preferences:' || v_user_id::text, 0)
  );

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
  'Atomically replaces the caller''s gender preferences. Empty array clears them. Serialised per user.';
