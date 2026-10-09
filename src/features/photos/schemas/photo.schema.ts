import { z } from 'zod';

import { MAX_PROFILE_PHOTO_BYTES, MAX_PROFILE_PHOTOS, PROFILE_PHOTO_MIME_TYPES } from '../types';

const dimension = z.number().int().positive().max(20000);

/**
 * Input for uploading a local image. Only what the picker provides; no user id, path, URL or
 * position is accepted (`.strict()`): the server derives all of those.
 */
export const uploadProfilePhotoSchema = z
  .object({
    localUri: z.string().trim().min(1, { message: 'A local file is required.' }),
    mimeType: z.enum(PROFILE_PHOTO_MIME_TYPES, { message: 'Use a JPEG, PNG or WebP image.' }),
    fileSizeBytes: z
      .number()
      .int()
      .positive()
      .max(MAX_PROFILE_PHOTO_BYTES, { message: 'Images must be 10 MB or smaller.' }),
    width: dimension.optional(),
    height: dimension.optional(),
  })
  .strict();

export const photoIdSchema = z.uuid({ message: 'Invalid photo.' });

/** A full new order of the caller's photos: unique ids, at most 6. */
export const reorderPhotoIdsSchema = z
  .array(photoIdSchema)
  .min(1)
  .max(MAX_PROFILE_PHOTOS)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Each photo must appear once.' });

/** `{uuid}/{uuid}.{jpg|png|webp}`: the only object paths this feature signs or removes. */
export const profilePhotoPathSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/,
  );

export type UploadProfilePhotoInput = z.input<typeof uploadProfilePhotoSchema>;
