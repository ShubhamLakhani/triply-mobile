# features/photos

The signed-in user's profile photos (see `supabase/README.md → Profile photos + storage`).

- `api/photo-api.ts`:
  - `fetchOwnProfilePhotos`
  - `uploadProfilePhoto`
  - `deleteProfilePhoto`
  - `setPrimaryPhoto`
  - `reorderProfilePhotos`
  - `createSignedPhotoUrl`
- `api/photo-file.ts`: `readLocalPhoto` (expo-file-system) and `newPhotoId` (UUID v4, no extra
  dependency)
- `api/photo-keys.ts`: `photoKeys.own(userId)`, `photoKeys.signedUrl(path)`
- `hooks/use-profile-photos.ts`:
  - `useOwnProfilePhotos`
  - `useUploadProfilePhoto`
  - `useDeleteProfilePhoto`
  - `useSetPrimaryPhoto`
  - `useReorderProfilePhotos`
  - `useSignedPhotoUrl`
- `schemas/photo.schema.ts`: upload input, photo id, reorder list, object path

Rules:

- **Limits:** up to 6 photos, JPEG/PNG/WebP only, 10 MB maximum. The database and the bucket
  enforce these; the app checks them too, for faster feedback.
- **Bucket:** private. Display uses 1-hour signed URLs that are cached in memory only and never
  stored in the database or persisted anywhere.
- **Upload:** reads the file, uploads it to `{userId}/{newId}.{ext}` (no overwrite), then calls
  `register_profile_photo`. If registration fails, the uploaded object is removed (best effort).
- **Delete:** calls `delete_profile_photo` (which returns the path), then removes the object. If
  the object removal fails, `objectRemoved: false` is returned and the orphan stays private
  until a future cleanup job removes it.
- **Ordering:** order and primary photo change only through RPCs, so the app never writes
  positions itself.
- **Picker (future UI):** the photo picker UI isn't built yet. When it is, use
  `expo-image-picker` with `exif: false`. Stripping metadata from the file bytes needs a
  re-encode step, which is planned for later.
- Screens must not call Supabase directly; use these hooks.
