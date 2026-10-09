import { getSupabaseClient } from '@/services/supabase';

import {
  photoIdSchema,
  profilePhotoPathSchema,
  reorderPhotoIdsSchema,
  uploadProfilePhotoSchema,
  type UploadProfilePhotoInput,
} from '../schemas/photo.schema';
import {
  buildProfilePhotoPath,
  MAX_PROFILE_PHOTO_BYTES,
  PROFILE_PHOTO_BUCKET,
  PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS,
  type DeletedProfilePhoto,
  type ProfilePhoto,
} from '../types';

import { newPhotoId, readLocalPhoto } from './photo-file';
import { PhotoError, toPhotoError } from './photo-errors';

export const PHOTO_COLUMNS =
  'id, user_id, storage_path, position, is_primary, mime_type, file_size_bytes, width, height, created_at, updated_at' as const;

function parseId(photoId: string): string {
  const parsed = photoIdSchema.safeParse(photoId);
  if (!parsed.success)
    throw new PhotoError('invalid_input', 'Invalid photo.', { cause: parsed.error });
  return parsed.data;
}

function bucket() {
  return getSupabaseClient().storage.from(PROFILE_PHOTO_BUCKET);
}

/** The caller's photo metadata in display order (position 0 first). */
export async function fetchOwnProfilePhotos(userId: string): Promise<ProfilePhoto[]> {
  const { data, error } = await getSupabaseClient()
    .from('profile_photos')
    .select(PHOTO_COLUMNS)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw toPhotoError(error);
  return data;
}

/**
 * Uploads a local image and registers it:
 *  1. validate type/size locally (the bucket and database enforce the same limits),
 *  2. upload the bytes to `{userId}/{newId}.{ext}` (no overwrite),
 *  3. register metadata via `register_profile_photo` (owner, limit, position, primary),
 *  4. if registration fails, remove the uploaded object (best effort) and rethrow.
 * `userId` only builds the path; the server checks it against the session.
 */
export async function uploadProfilePhoto(
  userId: string,
  input: UploadProfilePhotoInput,
): Promise<ProfilePhoto> {
  const parsed = uploadProfilePhotoSchema.safeParse(input);
  if (!parsed.success) {
    throw new PhotoError('invalid_input', 'Photo input is invalid.', { cause: parsed.error });
  }
  const { localUri, mimeType, width, height } = parsed.data;
  const photoId = newPhotoId();
  const path = buildProfilePhotoPath(userId, photoId, mimeType);

  const bytes = await readLocalPhoto(localUri);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROFILE_PHOTO_BYTES) {
    throw new PhotoError('invalid_input', 'Images must be between 1 byte and 10 MB.');
  }

  const upload = await bucket().upload(path, bytes, { contentType: mimeType, upsert: false });
  if (upload.error) {
    throw new PhotoError('upload_failed', 'Photo upload failed.', { cause: upload.error });
  }

  const { data, error } = await getSupabaseClient().rpc('register_profile_photo', {
    p_photo_id: photoId,
    p_storage_path: path,
    p_mime_type: mimeType,
    p_file_size_bytes: bytes.byteLength,
    ...(width ? { p_width: width } : {}),
    ...(height ? { p_height: height } : {}),
  });
  if (error) {
    // Cross-system rollback: the object is unregistered, so the owner may delete it.
    await bucket()
      .remove([path])
      .catch(() => undefined);
    throw toPhotoError(error);
  }
  return data;
}

/**
 * Deletes a photo: metadata first (renumbers positions, promotes a new primary), then the
 * object. If the object removal fails the photo is still gone for the user; the orphan object
 * stays private in their folder until a future cleanup job removes it.
 */
export async function deleteProfilePhoto(photoId: string): Promise<DeletedProfilePhoto> {
  const { data, error } = await getSupabaseClient().rpc('delete_profile_photo', {
    p_photo_id: parseId(photoId),
  });
  if (error) throw toPhotoError(error);
  if (typeof data !== 'string') {
    throw new PhotoError('unexpected_response', 'Unexpected delete response.');
  }
  const removal = await bucket()
    .remove([data])
    .catch((cause: unknown) => ({ error: cause }));
  return { storagePath: data, objectRemoved: !removal.error };
}

/** Makes one photo the primary (atomic). Returns all of the caller's photos in order. */
export async function setPrimaryPhoto(photoId: string): Promise<ProfilePhoto[]> {
  const { data, error } = await getSupabaseClient().rpc('set_primary_profile_photo', {
    p_photo_id: parseId(photoId),
  });
  if (error) throw toPhotoError(error);
  return data;
}

/** Replaces the order of ALL the caller's photos (atomic; primary unchanged). */
export async function reorderProfilePhotos(photoIds: string[]): Promise<ProfilePhoto[]> {
  const parsed = reorderPhotoIdsSchema.safeParse(photoIds);
  if (!parsed.success) {
    throw new PhotoError('invalid_input', 'Photo order is invalid.', { cause: parsed.error });
  }
  const { data, error } = await getSupabaseClient().rpc('reorder_profile_photos', {
    p_photo_ids: parsed.data,
  });
  if (error) throw toPhotoError(error);
  return data;
}

/**
 * Short-lived signed URL for displaying one of the caller's own photos (private bucket). Never
 * store the result; request a fresh one when it expires.
 */
export async function createSignedPhotoUrl(
  storagePath: string,
  expiresInSeconds: number = PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const parsed = profilePhotoPathSchema.safeParse(storagePath);
  if (!parsed.success) {
    throw new PhotoError('invalid_input', 'Invalid photo path.', { cause: parsed.error });
  }
  const { data, error } = await bucket().createSignedUrl(parsed.data, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new PhotoError('not_found', 'Photo is unavailable.', { cause: error });
  }
  return data.signedUrl;
}
