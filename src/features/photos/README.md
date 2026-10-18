# features/photos

The signed-in user's profile photos (see `supabase/README.md → Profile photos + storage`).

- `api/photo-api.ts`:
  - `fetchOwnProfilePhotos`
  - `uploadProfilePhoto`
  - `deleteProfilePhoto`
  - `setPrimaryPhoto`
  - `reorderProfilePhotos`
  - `createSignedPhotoUrl`
- `api/photo-picker.ts`: `pickProfilePhoto` (expo-image-picker, images only, `exif: false`,
  full quality, no camera/video), then normalization
- `api/photo-normalize.ts`: `normalizeProfilePhoto` (expo-image-manipulator): any picked image
  (iPhone HEIC/HEIF, JPEG, PNG, WebP, …) → JPEG, longest side ≤ 2048 px, quality 0.85, size
  re-checked (≤ 10 MB)
- `components/PhotoManager.tsx`: 3-column grid with empty slots, main badge, per-photo actions
  (make main, move left/right, remove) that work identically on Android and with assistive tech.
  With `protectLastPhoto` (onboarding complete) the only photo shows **Replace** instead of
  Remove: the new photo is uploaded and registered first, then the old one is deleted
- `components/PhotoTile.tsx`: one tile loaded through a signed URL
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
  enforce these; the app checks them too, for faster feedback. The app itself always uploads
  JPEG (after normalization).
- **Bucket:** private. Display uses 1-hour signed URLs that are cached in memory only and never
  stored in the database or persisted anywhere.
- **Upload:** reads the file, uploads it to `{userId}/{newId}.{ext}` (no overwrite), then calls
  `register_profile_photo`. If registration fails, the uploaded object is removed (best effort).
- **Delete:** calls `delete_profile_photo` (which returns the path), then removes the object. If
  the object removal fails, `objectRemoved: false` is returned and the orphan stays private
  until a future cleanup job removes it.
- **Ordering:** order and primary photo change only through RPCs, so the app never writes
  positions itself.
- **Last photo:** once onboarding is complete the database refuses to delete the last photo
  (`last_photo`, SQLSTATE `TR003`); every photo RPC also requires an active account
  (`account_inactive`).
- **Picker + metadata:** `exif: false` only keeps EXIF out of the picker's JS result; it does
  not change the file. The file that is uploaded is the **normalized** one: the image is decoded
  to pixels (orientation applied) and encoded again by expo-image-manipulator
  (`UIImage.jpegData` on iOS, `Bitmap.compress` on Android), which writes a fresh JPEG without
  the source's EXIF/GPS. That is the guarantee; there is no server-side metadata check, and the
  original HEIC/large file is never uploaded. The picker's temporary copy of the original
  (which keeps GPS) is deleted from the app cache right after normalization. Verified on the
  iOS simulator with a GPS-tagged 4032×3024 HEIC: the stored object is a 2048×1536 JPEG with no
  GPS/EXIF.
- **Progress:** Supabase JS has no byte-level upload progress; the grid shows an indeterminate
  "Uploading…" slot and recovers with a retryable message on failure.
- Screens must not call Supabase directly; use these hooks.
