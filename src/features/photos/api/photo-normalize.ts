import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import { MAX_PROFILE_PHOTO_BYTES } from '../types';

import { PhotoError } from './photo-errors';

/** Longest side of an uploaded profile photo, in pixels (camera originals are 4000+). */
export const PROFILE_PHOTO_MAX_DIMENSION = 2048;

/** JPEG quality for the re-encoded upload (0–1). */
export const PROFILE_PHOTO_JPEG_QUALITY = 0.85;

export interface NormalizedPhoto {
  localUri: string;
  mimeType: 'image/jpeg';
  fileSizeBytes: number;
  width: number;
  height: number;
}

/** Resize target that fits the longest side within `max` (aspect ratio kept); null if it fits. */
export function fitWithin(
  width: number,
  height: number,
  max: number = PROFILE_PHOTO_MAX_DIMENSION,
): { width: number } | { height: number } | null {
  if (width <= max && height <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

/**
 * Turns any image the picker returns (HEIC/HEIF from iPhone cameras, JPEG, PNG, WebP, …) into
 * the one format Triply uploads: a JPEG of at most 2048 px on the longest side.
 *
 * The image is decoded to pixels (camera orientation applied) and encoded again, and the new
 * file is what gets uploaded, never the original. The encoders used by expo-image-manipulator
 * (UIImage.jpegData on iOS, Bitmap.compress on Android) write a fresh JPEG and do not copy the
 * source's EXIF/GPS metadata; that is the extent of the guarantee (no server-side check).
 */
export async function normalizeProfilePhoto(sourceUri: string): Promise<NormalizedPhoto> {
  const context = ImageManipulator.manipulate(sourceUri);
  const rendered: ImageRef[] = [];
  try {
    let image = await context.renderAsync();
    rendered.push(image);
    const target = fitWithin(image.width, image.height);
    if (target) {
      context.resize(target);
      image = await context.renderAsync();
      rendered.push(image);
    }
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: PROFILE_PHOTO_JPEG_QUALITY,
    });
    const fileSizeBytes = new File(result.uri).size;
    if (!fileSizeBytes) {
      throw new PhotoError('invalid_input', 'We couldn’t prepare that photo. Try another one.');
    }
    if (fileSizeBytes > MAX_PROFILE_PHOTO_BYTES) {
      throw new PhotoError('invalid_input', 'That photo is too large. Try another one.');
    }
    return {
      localUri: result.uri,
      mimeType: 'image/jpeg',
      fileSizeBytes,
      width: result.width,
      height: result.height,
    };
  } catch (cause) {
    if (cause instanceof PhotoError) throw cause;
    throw new PhotoError('invalid_input', 'We couldn’t read that photo. Try another one.', {
      cause,
    });
  } finally {
    rendered.forEach((ref) => ref.release());
    context.release();
  }
}
