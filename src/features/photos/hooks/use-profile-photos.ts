import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSignedPhotoUrl,
  deleteProfilePhoto,
  fetchOwnProfilePhotos,
  reorderProfilePhotos,
  setPrimaryPhoto,
  uploadProfilePhoto,
} from '../api/photo-api';
import { PhotoError } from '../api/photo-errors';
import { photoKeys } from '../api/photo-keys';
import type { UploadProfilePhotoInput } from '../schemas/photo.schema';
import {
  PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS,
  type DeletedProfilePhoto,
  type ProfilePhoto,
} from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new PhotoError('not_authenticated', 'Not signed in.');
  return userId;
}

/** The signed-in user's photo metadata, ordered by position. */
export function useOwnProfilePhotos(userId: string | null) {
  return useQuery({
    queryKey: photoKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnProfilePhotos(requireUser(userId)),
    enabled: userId !== null,
  });
}

/** Uploads + registers a photo, then refreshes own photos. */
export function useUploadProfilePhoto(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ProfilePhoto, PhotoError | Error, UploadProfilePhotoInput>({
    mutationFn: (input) => uploadProfilePhoto(requireUser(userId), input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: photoKeys.own(requireUser(userId)) });
    },
  });
}

/** Deletes a photo, drops its cached signed URL and refreshes own photos. */
export function useDeleteProfilePhoto(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<DeletedProfilePhoto, PhotoError | Error, string>({
    mutationFn: (photoId) => {
      requireUser(userId);
      return deleteProfilePhoto(photoId);
    },
    onSuccess: async (deleted) => {
      queryClient.removeQueries({ queryKey: photoKeys.signedUrl(deleted.storagePath) });
      await queryClient.invalidateQueries({ queryKey: photoKeys.own(requireUser(userId)) });
    },
  });
}

/** Sets the primary photo; caches the server's ordered result. */
export function useSetPrimaryPhoto(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ProfilePhoto[], PhotoError | Error, string>({
    mutationFn: (photoId) => {
      requireUser(userId);
      return setPrimaryPhoto(photoId);
    },
    onSuccess: (photos) => {
      queryClient.setQueryData(photoKeys.own(requireUser(userId)), photos);
    },
  });
}

/** Reorders all photos; caches the server's ordered result. */
export function useReorderProfilePhotos(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ProfilePhoto[], PhotoError | Error, string[]>({
    mutationFn: (photoIds) => {
      requireUser(userId);
      return reorderProfilePhotos(photoIds);
    },
    onSuccess: (photos) => {
      queryClient.setQueryData(photoKeys.own(requireUser(userId)), photos);
    },
  });
}

// Refresh well before expiry and drop unused URLs before they expire.
const SIGNED_URL_TTL_MS = PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS * 1000;

/** A short-lived signed URL for one of the user's own photos (memory cache only). */
export function useSignedPhotoUrl(storagePath: string | null) {
  return useQuery({
    queryKey: photoKeys.signedUrl(storagePath ?? ''),
    queryFn: () => createSignedPhotoUrl(storagePath ?? ''),
    enabled: storagePath !== null && storagePath !== '',
    staleTime: SIGNED_URL_TTL_MS * 0.75,
    gcTime: SIGNED_URL_TTL_MS * 0.8,
  });
}
