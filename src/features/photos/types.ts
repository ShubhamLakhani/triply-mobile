import type { Tables } from '@/services/supabase';

/** Private Supabase Storage bucket for profile photos (never public). */
export const PROFILE_PHOTO_BUCKET = 'profile-photos';

/** Maximum photos per user (enforced by the database: positions 0..5). */
export const MAX_PROFILE_PHOTOS = 6;

/** Maximum upload size in bytes (10 MiB; bucket limit + database CHECK). */
export const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;

/** Signed URL lifetime for normal display. Never persist signed URLs. */
export const PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Supported upload types and the file extension the server expects for each. */
export const PROFILE_PHOTO_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export const PROFILE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];

/** A profile photo metadata row (generated types). Contains a storage path, never a URL. */
export type ProfilePhoto = Tables<'profile_photos'>;

/**
 * Canonical object path inside the bucket: `{userId}/{photoId}.{ext}`. The server recomputes this
 * path and rejects anything else, so it is never taken from user input.
 */
export function buildProfilePhotoPath(
  userId: string,
  photoId: string,
  mimeType: ProfilePhotoMimeType,
): string {
  return `${userId}/${photoId}.${PROFILE_PHOTO_MIME_EXTENSIONS[mimeType]}`;
}

/** Result of deleting a photo: metadata is gone; the object removal is best effort. */
export interface DeletedProfilePhoto {
  storagePath: string;
  /** False if the storage object could not be removed (an orphan; cleaned up later). */
  objectRemoved: boolean;
}
