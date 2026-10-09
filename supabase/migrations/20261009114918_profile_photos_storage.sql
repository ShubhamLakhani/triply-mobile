-- =============================================================================
-- Triply · Phase 1M-G · Profile photos + storage
-- =============================================================================
--
-- Storage
--   Bucket `profile-photos` is PRIVATE (public = false): no permanent public
--   URLs. Display uses short-lived signed URLs created by the client for its own
--   objects; signed URLs are never stored in the database. Bucket-level limits
--   (enforced by the Storage API on upload): 10 MiB, image/jpeg|png|webp.
--
--   Object path (inside the bucket):  {user_id}/{photo_id}.{ext}
--     user_id   = auth.uid() of the uploader (first folder segment)
--     photo_id  = client-generated UUID, becomes profile_photos.id
--     ext       = derived from the validated MIME type only:
--                 image/jpeg → jpg, image/png → png, image/webp → webp
--   The path is fully determined by (user_id, photo_id, mime_type); the
--   register RPC recomputes it and rejects anything else.
--
-- Table public.profile_photos (metadata only; RPC-only writes)
--   * max 6 photos per user, positions 0..5 (zero-based). The CHECK on position
--     plus UNIQUE (user_id, position) makes a 7th row physically impossible;
--     the RPCs serialise per user (advisory lock) and keep positions contiguous.
--   * at most one primary per user (partial unique index); RPCs keep exactly
--     one primary whenever the user has photos: first photo becomes primary,
--     deleting the primary promotes the lowest remaining position, reorder
--     never changes the primary, set_primary switches atomically.
--   * storage_path is unique and must equal the canonical path (CHECK).
--
-- RPCs (SECURITY DEFINER, search_path = '', owner = auth.uid())
--   register_profile_photo(photo_id, storage_path, mime, size, width?, height?)
--     requires the object to already exist in storage; idempotent for the same
--     photo_id + path (returns the existing row); 54000 when 6 photos exist.
--   delete_profile_photo(photo_id) → storage_path (app then removes the object)
--   set_primary_profile_photo(photo_id) → the caller's photos, ordered
--   reorder_profile_photos(photo_ids[]) → the caller's photos, ordered
--   Unknown or foreign photo ids → P0002 'photo not found' (no existence leak).
--
-- Storage policies (storage.objects, bucket_id = 'profile-photos' only)
--   SELECT  own folder only                (needed for signed URLs)
--   INSERT  own folder + canonical file name ({uuid}.jpg|png|webp) only.
--           There is no per-folder object cap in the policy (a policy on
--           storage.objects cannot count storage.objects without recursion);
--           unregistered uploads are bounded only by the bucket size limit per
--           object — see "Cross-system caveat".
--   DELETE  own folder, and only objects NOT registered in profile_photos
--           (call delete_profile_photo first; keeps metadata ⇄ object consistent)
--   UPDATE  none (no upsert/overwrite: every photo is a new object)
--   anon    nothing
--
-- Cross-system caveat
--   Storage and Postgres are not one transaction. Upload-then-register failures
--   are cleaned up by the app (best effort); a failed object delete after a
--   successful delete_profile_photo leaves an orphan object in the user's own
--   folder. Orphans (objects with no profile_photos row) are invisible to other
--   users; a later admin/cron cleanup (and, if needed, an upload quota) will
--   remove them (not part of this phase). Account deletion cascades metadata
--   but not objects (same future cleanup).
--
-- Rollback / recovery (manual only; prefer a forward fix once data exists)
--   drop policy if exists "profile_photos_objects_select_own" on storage.objects;
--   drop policy if exists "profile_photos_objects_insert_own" on storage.objects;
--   drop policy if exists "profile_photos_objects_delete_own_unregistered" on storage.objects;
--   drop function if exists public.reorder_profile_photos(uuid[]);
--   drop function if exists public.set_primary_profile_photo(uuid);
--   drop function if exists public.delete_profile_photo(uuid);
--   drop function if exists public.register_profile_photo(uuid, text, text, integer, integer, integer);
--   drop function if exists private.lock_profile_photos(uuid), private.normalize_profile_photos(uuid);
--   drop table if exists public.profile_photos;
--   -- bucket: remove objects via the Storage API first, then delete the bucket.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage bucket (deterministic: re-applying converges to the same config)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos', 'profile-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- public.profile_photos
-- -----------------------------------------------------------------------------

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  position smallint not null,
  is_primary boolean not null default false,
  mime_type text not null,
  file_size_bytes integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_photos_storage_path_key unique (storage_path),
  -- Deferrable so reorder/normalise can permute positions inside one transaction.
  constraint profile_photos_user_position_key unique (user_id, position)
    deferrable initially immediate,
  constraint profile_photos_position_range check (position between 0 and 5),
  constraint profile_photos_mime_type_valid
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint profile_photos_file_size_valid
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint profile_photos_width_valid check (width is null or width between 1 and 20000),
  constraint profile_photos_height_valid check (height is null or height between 1 and 20000),
  constraint profile_photos_storage_path_canonical check (
    storage_path = user_id::text || '/' || id::text || '.' ||
      case mime_type
        when 'image/jpeg' then 'jpg'
        when 'image/png' then 'png'
        when 'image/webp' then 'webp'
      end
  )
);

comment on table public.profile_photos is
  'Profile photo metadata (max 6, positions 0..5, one primary). Objects live in the private profile-photos bucket at {user_id}/{id}.{ext}. Written only by the profile photo RPCs; readable only by the owner. Never stores URLs.';

-- At most one primary per user.
create unique index profile_photos_one_primary_per_user
  on public.profile_photos (user_id) where is_primary;

create trigger set_updated_at
  before update on public.profile_photos
  for each row execute function private.set_updated_at();

-- Immutable identity/file fields (defense in depth for privileged writes too).
create or replace function private.profile_photos_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.storage_path is distinct from old.storage_path
     or new.mime_type is distinct from old.mime_type
     or new.file_size_bytes is distinct from old.file_size_bytes then
    raise exception 'profile photo identity cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profile_photos_before_update
  before update on public.profile_photos
  for each row execute function private.profile_photos_before_update();

-- -----------------------------------------------------------------------------
-- Private helpers (not callable by API roles)
-- -----------------------------------------------------------------------------

-- Serialises every photo mutation for one user (limit, positions, primary).
create or replace function private.lock_profile_photos(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('triply.profile_photos:' || p_user_id::text, 0)
  );
$$;

-- Renumbers positions 0..n-1 (keeping order) and guarantees exactly one
-- primary when the user has photos (promotes the lowest position if missing).
create or replace function private.normalize_profile_photos(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  set constraints public.profile_photos_user_position_key deferred;

  update public.profile_photos p
     set position = o.new_position
    from (
      select id, (row_number() over (order by position, created_at, id) - 1)::smallint as new_position
        from public.profile_photos
       where user_id = p_user_id
    ) o
   where p.id = o.id and p.position is distinct from o.new_position;

  set constraints public.profile_photos_user_position_key immediate;

  if not exists (
    select 1 from public.profile_photos where user_id = p_user_id and is_primary
  ) then
    update public.profile_photos
       set is_primary = true
     where id = (
       select id from public.profile_photos
        where user_id = p_user_id
        order by position
        limit 1
     );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: register_profile_photo
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
  v_actor uuid := auth.uid();
  v_ext text;
  v_path text;
  v_count integer;
  v_row public.profile_photos;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
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

comment on function public.register_profile_photo(uuid, text, text, integer, integer, integer) is
  'Registers an uploaded profile photo for the caller (canonical path, max 6, next position, first photo primary). Idempotent per photo id.';

-- -----------------------------------------------------------------------------
-- RPC: delete_profile_photo
-- -----------------------------------------------------------------------------

create or replace function public.delete_profile_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_path text;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  perform private.lock_profile_photos(v_actor);

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
  'Deletes one of the caller''s photo rows, renumbers positions, promotes a new primary if needed and returns the storage path for the app to remove.';

-- -----------------------------------------------------------------------------
-- RPC: set_primary_profile_photo
-- -----------------------------------------------------------------------------

create or replace function public.set_primary_profile_photo(p_photo_id uuid)
returns setof public.profile_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

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

comment on function public.set_primary_profile_photo(uuid) is
  'Atomically makes one of the caller''s photos the primary. Returns the caller''s photos in order.';

-- -----------------------------------------------------------------------------
-- RPC: reorder_profile_photos
-- -----------------------------------------------------------------------------

create or replace function public.reorder_profile_photos(p_photo_ids uuid[])
returns setof public.profile_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_owned integer;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

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

comment on function public.reorder_profile_photos(uuid[]) is
  'Atomically reorders all of the caller''s photos (positions 0..n-1). The primary photo is unchanged.';

-- -----------------------------------------------------------------------------
-- Privileges (explicit; do not rely on Supabase default grants)
-- -----------------------------------------------------------------------------

revoke all on function private.profile_photos_before_update() from public, anon, authenticated;
revoke all on function private.lock_profile_photos(uuid) from public, anon, authenticated;
revoke all on function private.normalize_profile_photos(uuid) from public, anon, authenticated;

revoke all on function public.register_profile_photo(uuid, text, text, integer, integer, integer) from public, anon;
revoke all on function public.delete_profile_photo(uuid) from public, anon;
revoke all on function public.set_primary_profile_photo(uuid) from public, anon;
revoke all on function public.reorder_profile_photos(uuid[]) from public, anon;
grant execute on function public.register_profile_photo(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function public.delete_profile_photo(uuid) to authenticated;
grant execute on function public.set_primary_profile_photo(uuid) to authenticated;
grant execute on function public.reorder_profile_photos(uuid[]) to authenticated;

revoke all on table public.profile_photos from public, anon, authenticated;
grant select on table public.profile_photos to authenticated;
grant all on table public.profile_photos to service_role;

-- -----------------------------------------------------------------------------
-- Row level security (metadata)
-- -----------------------------------------------------------------------------

alter table public.profile_photos enable row level security;

-- Own photos only. Other users' photos will be exposed later through a
-- controlled discovery layer (block-aware, signed URLs created server-side).
create policy "profile_photos_select_own"
  on public.profile_photos for select to authenticated
  using ((select auth.uid()) = user_id);

-- Intentionally no INSERT/UPDATE/DELETE policies: all writes go through the RPCs.

-- -----------------------------------------------------------------------------
-- Storage policies (storage.objects already has RLS enabled by Supabase)
-- -----------------------------------------------------------------------------

create policy "profile_photos_objects_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "profile_photos_objects_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and name ~ (
      '^' || (select auth.uid()::text)
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  );

create policy "profile_photos_objects_delete_own_unregistered"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and not exists (
      select 1 from public.profile_photos p where p.storage_path = objects.name
    )
  );

-- No UPDATE policy: objects are never overwritten (upload with upsert = false).
