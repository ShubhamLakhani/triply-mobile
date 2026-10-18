-- =============================================================================
-- Triply · Pre-3M · M-03 · Profile / onboarding model
-- =============================================================================
--
-- Implements the approved profile states (decision pass, topics 2-5):
--
--   1. Core complete     profiles.is_profile_complete (unchanged meaning: first
--                        name, date of birth, 18+, gender). Database-maintained.
--   2. Onboarding        profiles.onboarding_completed_at, set ONLY by
--      complete           public.complete_onboarding() after it validates, in one
--                        transaction: core complete, a primary photo (so >= 1
--                        photo), 3-8 interests, >= 1 gender preference and a valid
--                        age range. Bio and home city/country are optional.
--                        Clients have no privilege on the column; once set it can
--                        never be changed or cleared (trigger).
--   3. Discovery         computed later (Phase 4M); never stored.
--      eligible
--   4. Pause             profiles.discovery_paused_at: user intent only, written
--                        through public.set_discovery_paused(boolean) with server
--                        time. Never cleared automatically. (UI in Phase 4M.)
--
-- Date of birth
--   * Under-18 and future dates are rejected whenever the date is written, so the
--     stored is_profile_complete can no longer go stale on an 18th birthday
--     (decision pass, finding D). Rows written before this migration are not
--     re-validated unless their date of birth changes.
--   * After onboarding completes, end users cannot change it (support changes
--     run without a user JWT and are exempt).
--
-- Post-onboarding invariants (end-user writes; onboarding steps before
-- completion stay freely writable so they can be saved incrementally)
--   * first name and gender stay set (core stays complete)
--   * interests stay within 3-8        (replace_profile_interests)
--   * >= 1 gender preference           (set_discovery_gender_preferences)
--   * the last photo cannot be deleted (delete_profile_photo); replacing it
--     (register the new photo, then delete the old one) still works
--   * date of birth locked
--   Direct client INSERT/DELETE on profile_interests and
--   discovery_gender_preferences is revoked, so the RPCs are the only write path
--   and the invariants cannot be bypassed. Both RPCs become SECURITY DEFINER.
--
-- Account status (M-02): profile, preference, interest and photo writes and
-- complete_onboarding() require an active account (SQLSTATE TR001).
--
-- Limits
--   * bio: optional, trimmed, 1-500 characters (was 1-1000; Dev had no longer bio)
--   * interests: at most 8 per user (was 10; Dev had no user above 8)
--
-- Error contract (SQLSTATE → mobile code; `details` carries a stable key)
--   TR001  account inactive
--   TR002  onboarding requirements not met; details = comma-separated subset of
--          profile,photos,interests,gender_preferences,age_range
--   TR003  change blocked after onboarding; details = date_of_birth_locked |
--          core_profile_required | interests_minimum | gender_preferences_required |
--          last_photo
--   23514  details = date_of_birth_future | date_of_birth_under_18 (+ the existing
--          CHECK constraint violations, e.g. bio too long, more than 8 interests)
--
-- Deprecated (kept so installed preview builds that still select them keep
-- working; dropped with the discovery migration in Phase 4M)
--   * profiles.is_discoverable: no client privilege, always false (trigger). The
--     old stored, trigger-cleared flag went stale (decision pass, finding N1).
--   * discovery_preferences.max_distance_km: no client privilege, unused. Triply
--     does not do location-based matching.
--
-- Backfill: profiles that already satisfy every requirement get
-- onboarding_completed_at = now(). Nothing is deleted or rewritten.
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   Re-run the previous definitions of the replaced functions from
--   20261009092316 (profiles_before_write), 20261009103602
--   (discovery_preferences_before_update, profile_interests_before_insert),
--   20261009122115 (replace_profile_interests, set_discovery_gender_preferences)
--   and 20261009114918 (photo RPCs); then
--   drop function if exists public.complete_onboarding(), public.set_discovery_paused(boolean),
--     private.onboarding_missing_requirements(uuid);
--   alter table public.profiles drop column onboarding_completed_at, drop column discovery_paused_at;
--   restore the 1000-character bio constraint and the dropped grants/policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: new columns, bio limit, deprecations
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column onboarding_completed_at timestamptz,
  add column discovery_paused_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Set once by complete_onboarding() after server-side validation. Never writable by clients; never changed or cleared.';
comment on column public.profiles.discovery_paused_at is
  'User intent to pause discovery (set_discovery_paused). Never cleared automatically. Eligibility is computed, not stored.';
comment on column public.profiles.is_discoverable is
  'DEPRECATED (Pre-3M): always false, not writable. Discoverability is computed in Phase 4M; dropped there.';

alter table public.profiles drop constraint profiles_bio_valid;
alter table public.profiles add constraint profiles_bio_valid
  check (bio is null or (char_length(bio) between 1 and 500
         and bio = btrim(bio, E' \t\n\r\f')));

revoke update (is_discoverable) on table public.profiles from authenticated;

comment on column public.discovery_preferences.max_distance_km is
  'DEPRECATED (Pre-3M): unused and not writable by clients. No location-based matching. Dropped in Phase 4M.';

revoke update (max_distance_km) on table public.discovery_preferences from authenticated;

-- -----------------------------------------------------------------------------
-- profiles write trigger (replaces the 1M-B version)
-- -----------------------------------------------------------------------------

create or replace function private.profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_dob_changed boolean;
  v_completed boolean;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'profiles.id cannot be changed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;

    if old.onboarding_completed_at is not null
       and new.onboarding_completed_at is distinct from old.onboarding_completed_at then
      raise exception 'onboarding completion cannot be changed' using errcode = '42501';
    end if;

    -- End-user writes need an active account. Service/migration writes have no auth.uid().
    if v_actor is not null and not private.account_is_active(v_actor) then
      raise exception 'account inactive' using errcode = 'TR001';
    end if;

    v_dob_changed := new.date_of_birth is distinct from old.date_of_birth;
    v_completed := old.onboarding_completed_at is not null;
  else
    new.created_at := now();
    new.updated_at := now();
    new.onboarding_completed_at := null;
    v_dob_changed := new.date_of_birth is not null;
    v_completed := false;
  end if;

  new.first_name   := private.normalize_text(new.first_name);
  new.bio          := private.normalize_text(new.bio);
  new.home_city    := private.normalize_text(new.home_city);
  new.home_country := private.normalize_text(new.home_country);
  new.occupation   := private.normalize_text(new.occupation);

  if v_completed and v_actor is not null and v_dob_changed then
    raise exception 'date of birth cannot be changed after onboarding'
      using errcode = 'TR003', detail = 'date_of_birth_locked';
  end if;

  if new.date_of_birth is not null and new.date_of_birth > current_date then
    raise exception 'date_of_birth cannot be in the future'
      using errcode = '23514', detail = 'date_of_birth_future';
  end if;

  if v_dob_changed and new.date_of_birth is not null and not private.is_adult(new.date_of_birth) then
    raise exception 'you must be 18 or older'
      using errcode = '23514', detail = 'date_of_birth_under_18';
  end if;

  new.is_profile_complete :=
    private.profile_is_complete(new.first_name, new.date_of_birth, new.gender);

  if v_completed and v_actor is not null and not new.is_profile_complete then
    raise exception 'first name and gender are required after onboarding'
      using errcode = 'TR003', detail = 'core_profile_required';
  end if;

  -- Deprecated column: constant false until it is dropped (Phase 4M).
  new.is_discoverable := false;

  return new;
end;
$$;

comment on function private.profiles_before_write() is
  'BEFORE INSERT/UPDATE on public.profiles: protected columns, text normalisation, DOB rules (no future, 18+, locked after onboarding), completeness, active-account check, deprecated is_discoverable forced false.';

-- -----------------------------------------------------------------------------
-- discovery_preferences: active-account check (SECURITY DEFINER to reach private.*)
-- -----------------------------------------------------------------------------

create or replace function private.discovery_preferences_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'discovery preferences owner cannot be changed' using errcode = '42501';
  end if;
  if auth.uid() is not null and not private.account_is_active(auth.uid()) then
    raise exception 'account inactive' using errcode = 'TR001';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

comment on function private.discovery_preferences_before_update() is
  'BEFORE UPDATE on public.discovery_preferences: owner immutable, created_at preserved, active account required for end-user writes.';

-- -----------------------------------------------------------------------------
-- Interests: max 8, RPC-only writes
-- -----------------------------------------------------------------------------

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

  if (select count(*) from public.profile_interests pi where pi.user_id = new.user_id) >= 8 then
    raise exception 'a profile can have at most 8 interests' using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function private.profile_interests_before_insert() is
  'BEFORE INSERT on public.profile_interests: active interests only, max 8 per user, DB-controlled created_at.';

revoke insert, delete on table public.profile_interests from authenticated;
drop policy if exists "profile_interests_insert_own" on public.profile_interests;
drop policy if exists "profile_interests_delete_own" on public.profile_interests;

comment on table public.profile_interests is
  'A user''s selected interests (max 8; 3-8 once onboarding is complete). Owner-only SELECT; writes via replace_profile_interests().';

-- SECURITY DEFINER: clients no longer write the table directly. The caller is
-- always auth.uid(); the max-8 trigger and active-interest check still apply.
create or replace function public.replace_profile_interests(p_interest_ids uuid[])
returns setof public.profile_interests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_ids uuid[];
begin
  v_user_id := private.assert_active_actor();
  if p_interest_ids is null or array_position(p_interest_ids, null) is not null then
    raise exception 'interest ids must be a non-null array without nulls' using errcode = '22023';
  end if;

  -- Same key as the max-8 insert trigger and complete_onboarding().
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.profile_interests:' || v_user_id::text, 0)
  );

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_interest_ids) as t(x);
  if cardinality(v_ids) > 8 then
    raise exception 'a profile can have at most 8 interests' using errcode = '23514';
  end if;
  if cardinality(v_ids) < 3 and exists (
    select 1 from public.profiles p where p.id = v_user_id and p.onboarding_completed_at is not null
  ) then
    raise exception 'a completed profile needs at least 3 interests'
      using errcode = 'TR003', detail = 'interests_minimum';
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
  'Atomically replaces the caller''s interests (max 8; at least 3 once onboarding is complete; active interests only). Active account required. Serialised per user.';

-- -----------------------------------------------------------------------------
-- Gender preferences: RPC-only writes, >= 1 after onboarding
-- -----------------------------------------------------------------------------

revoke insert, delete on table public.discovery_gender_preferences from authenticated;
drop policy if exists "discovery_gender_preferences_insert_own" on public.discovery_gender_preferences;
drop policy if exists "discovery_gender_preferences_delete_own" on public.discovery_gender_preferences;

comment on table public.discovery_gender_preferences is
  'Genders a user wants to meet (>= 1 once onboarding is complete; "Everyone" = every value). Owner-only SELECT; writes via set_discovery_gender_preferences().';

create or replace function public.set_discovery_gender_preferences(p_genders text[])
returns setof public.discovery_gender_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_genders text[];
begin
  v_user_id := private.assert_active_actor();
  if p_genders is null or array_position(p_genders, null) is not null then
    raise exception 'genders must be a non-null array without nulls' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.discovery_gender_preferences:' || v_user_id::text, 0)
  );

  select coalesce(array_agg(distinct g), '{}') into v_genders from unnest(p_genders) as t(g);
  if cardinality(v_genders) = 0 and exists (
    select 1 from public.profiles p where p.id = v_user_id and p.onboarding_completed_at is not null
  ) then
    raise exception 'a completed profile needs at least one gender preference'
      using errcode = 'TR003', detail = 'gender_preferences_required';
  end if;

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
  'Atomically replaces the caller''s gender preferences (canonical values only; at least one once onboarding is complete). Active account required. Serialised per user.';

-- -----------------------------------------------------------------------------
-- Photo RPCs: active account + last-photo guard (bodies otherwise unchanged
-- from 20261009114918)
-- -----------------------------------------------------------------------------

create or replace function public.register_profile_photo(
  p_photo_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes integer,
  p_width integer default null,
  p_height integer default null
)
returns public.profile_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_ext text;
  v_path text;
  v_count integer;
  v_row public.profile_photos;
begin
  v_actor := private.assert_active_actor();
  if p_photo_id is null or p_storage_path is null or p_mime_type is null or p_file_size_bytes is null then
    raise exception 'photo id, path, type and size are required' using errcode = '22023';
  end if;

  v_ext := case p_mime_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
  end;
  if v_ext is null then
    raise exception 'unsupported image type' using errcode = '22023';
  end if;
  if p_file_size_bytes <= 0 or p_file_size_bytes > 10485760 then
    raise exception 'image must be between 1 byte and 10 MB' using errcode = '22023';
  end if;
  if (p_width is not null and (p_width < 1 or p_width > 20000))
     or (p_height is not null and (p_height < 1 or p_height > 20000)) then
    raise exception 'invalid image dimensions' using errcode = '22023';
  end if;

  v_path := v_actor::text || '/' || p_photo_id::text || '.' || v_ext;
  if p_storage_path <> v_path then
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  perform private.lock_profile_photos(v_actor);

  -- Idempotent retry: the same photo already registered by this user.
  select * into v_row from public.profile_photos p where p.id = p_photo_id;
  if found then
    if v_row.user_id = v_actor and v_row.storage_path = v_path then
      return v_row;
    end if;
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'profile-photos' and o.name = v_path
  ) then
    raise exception 'photo upload not found' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.profile_photos p where p.user_id = v_actor;
  if v_count >= 6 then
    raise exception 'profile photo limit reached' using errcode = '54000';
  end if;

  insert into public.profile_photos as p
    (id, user_id, storage_path, position, is_primary, mime_type, file_size_bytes, width, height)
  values (
    p_photo_id, v_actor, v_path, v_count::smallint,
    not exists (select 1 from public.profile_photos x where x.user_id = v_actor and x.is_primary),
    p_mime_type, p_file_size_bytes, p_width, p_height
  )
  returning p.* into v_row;

  return v_row;
end;
$$;

create or replace function public.delete_profile_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_path text;
begin
  v_actor := private.assert_active_actor();

  perform private.lock_profile_photos(v_actor);

  -- A completed profile always keeps at least one photo: replace it by registering
  -- the new photo first, then deleting the old one.
  if exists (
       select 1 from public.profile_photos p where p.id = p_photo_id and p.user_id = v_actor
     )
     and (select count(*) from public.profile_photos p where p.user_id = v_actor) <= 1
     and exists (
       select 1 from public.profiles pr
        where pr.id = v_actor and pr.onboarding_completed_at is not null
     ) then
    raise exception 'a completed profile needs at least one photo'
      using errcode = 'TR003', detail = 'last_photo';
  end if;

  delete from public.profile_photos p
   where p.id = p_photo_id and p.user_id = v_actor
  returning p.storage_path into v_path;

  if v_path is null then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;

  perform private.normalize_profile_photos(v_actor);
  return v_path;
end;
$$;

comment on function public.delete_profile_photo(uuid) is
  'Deletes one of the caller''s photo rows (never the last one once onboarding is complete), renumbers positions, promotes a new primary if needed and returns the storage path for the app to remove.';

create or replace function public.set_primary_profile_photo(p_photo_id uuid)
returns setof public.profile_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.assert_active_actor();

  perform private.lock_profile_photos(v_actor);

  if not exists (
    select 1 from public.profile_photos p where p.id = p_photo_id and p.user_id = v_actor
  ) then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;

  update public.profile_photos p
     set is_primary = false
   where p.user_id = v_actor and p.is_primary and p.id <> p_photo_id;
  update public.profile_photos p
     set is_primary = true
   where p.id = p_photo_id and not p.is_primary;

  return query
    select * from public.profile_photos p where p.user_id = v_actor order by p.position;
end;
$$;

create or replace function public.reorder_profile_photos(p_photo_ids uuid[])
returns setof public.profile_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_owned integer;
begin
  v_actor := private.assert_active_actor();

  perform private.lock_profile_photos(v_actor);

  select count(*) into v_owned from public.profile_photos p where p.user_id = v_actor;

  -- Exactly the caller's photos, each once. Foreign/unknown ids fail the same
  -- way as duplicates or omissions (no existence leak).
  if p_photo_ids is null
     or coalesce(pg_catalog.array_length(p_photo_ids, 1), 0) <> v_owned
     or pg_catalog.array_position(p_photo_ids, null) is not null
     or (select count(distinct x) from pg_catalog.unnest(p_photo_ids) x) <> v_owned
     or exists (
       select 1 from pg_catalog.unnest(p_photo_ids) x
        where not exists (
          select 1 from public.profile_photos p where p.id = x and p.user_id = v_actor
        )
     ) then
    raise exception 'photo order must list each of your photos exactly once' using errcode = '22023';
  end if;

  set constraints public.profile_photos_user_position_key deferred;

  update public.profile_photos p
     set position = (o.ord - 1)::smallint
    from pg_catalog.unnest(p_photo_ids) with ordinality as o (id, ord)
   where p.id = o.id and p.user_id = v_actor and p.position <> (o.ord - 1);

  set constraints public.profile_photos_user_position_key immediate;

  return query
    select * from public.profile_photos p where p.user_id = v_actor order by p.position;
end;
$$;

-- -----------------------------------------------------------------------------
-- Onboarding completion
-- -----------------------------------------------------------------------------

create or replace function private.onboarding_missing_requirements(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when not exists (
      select 1 from public.profiles p
       where p.id = p_user_id and p.is_profile_complete and private.is_adult(p.date_of_birth)
    ) then 'profile' end,
    case when not exists (
      select 1 from public.profile_photos ph where ph.user_id = p_user_id and ph.is_primary
    ) then 'photos' end,
    case when (
      select count(*) from public.profile_interests pi where pi.user_id = p_user_id
    ) not between 3 and 8 then 'interests' end,
    case when not exists (
      select 1 from public.discovery_gender_preferences g where g.user_id = p_user_id
    ) then 'gender_preferences' end,
    case when not exists (
      select 1 from public.discovery_preferences d
       where d.user_id = p_user_id and d.min_age >= 18 and d.max_age <= 99 and d.max_age >= d.min_age
    ) then 'age_range' end
  ], null);
$$;

comment on function private.onboarding_missing_requirements(uuid) is
  'Onboarding requirements the user does not meet yet (empty = complete): profile, photos, interests, gender_preferences, age_range.';

create or replace function public.complete_onboarding()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_missing text[];
  v_row public.profiles;
begin
  v_actor := private.assert_active_actor();

  -- The same per-user locks as the photo, interest and gender-preference writers
  -- (fixed order), so no concurrent edit can change the validated state before
  -- this transaction commits.
  perform private.lock_profile_photos(v_actor);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.profile_interests:' || v_actor::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.discovery_gender_preferences:' || v_actor::text, 0)
  );

  select * into v_row from public.profiles p where p.id = v_actor for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  -- Idempotent: completing twice returns the existing row unchanged.
  if v_row.onboarding_completed_at is not null then
    return v_row;
  end if;

  v_missing := private.onboarding_missing_requirements(v_actor);
  if cardinality(v_missing) > 0 then
    raise exception 'onboarding requirements not met'
      using errcode = 'TR002', detail = array_to_string(v_missing, ',');
  end if;

  update public.profiles p
     set onboarding_completed_at = now()
   where p.id = v_actor
  returning p.* into v_row;

  return v_row;
end;
$$;

comment on function public.complete_onboarding() is
  'Validates every onboarding requirement for auth.uid() in one transaction and sets onboarding_completed_at once (idempotent). TR002 + details lists what is missing.';

-- -----------------------------------------------------------------------------
-- Discovery pause (user intent; eligibility is computed in Phase 4M)
-- -----------------------------------------------------------------------------

create or replace function public.set_discovery_paused(p_paused boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_paused_at timestamptz;
begin
  v_actor := private.assert_active_actor();
  if p_paused is null then
    raise exception 'paused must be true or false' using errcode = '22023';
  end if;

  update public.profiles p
     set discovery_paused_at = case
           when p_paused then coalesce(p.discovery_paused_at, now())
           else null
         end
   where p.id = v_actor
  returning p.discovery_paused_at into v_paused_at;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return v_paused_at;
end;
$$;

comment on function public.set_discovery_paused(boolean) is
  'Pauses (keeps the original pause time) or resumes discovery for the caller. Returns discovery_paused_at. Active account required.';

-- -----------------------------------------------------------------------------
-- Backfill: profiles that already meet every requirement
-- -----------------------------------------------------------------------------

update public.profiles p
   set onboarding_completed_at = now()
 where p.onboarding_completed_at is null
   and cardinality(private.onboarding_missing_requirements(p.id)) = 0;

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.onboarding_missing_requirements(uuid) from public, anon, authenticated;

revoke all on function public.complete_onboarding() from public, anon;
revoke all on function public.set_discovery_paused(boolean) from public, anon;
grant execute on function public.complete_onboarding() to authenticated, service_role;
grant execute on function public.set_discovery_paused(boolean) to authenticated, service_role;
