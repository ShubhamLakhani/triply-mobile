import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import type { ProfilePhotoMimeType } from '../types';

import { PhotoError } from './photo-errors';
import { normalizeProfilePhoto } from './photo-normalize';

export interface PickedPhoto {
  /** The normalized JPEG in the app cache (never the original library file). */
  localUri: string;
  mimeType: ProfilePhotoMimeType;
  fileSizeBytes: number;
  width?: number;
  height?: number;
}

/**
 * Opens the system photo library (images only, no camera, no video) and returns a normalized
 * JPEG ready for upload (see photo-normalize.ts). Any image format the library holds is
 * accepted, including iPhone HEIC/HEIF. Resolves to null when the user cancels; throws a typed
 * PhotoError for denied permission or an image that cannot be decoded.
 *
 * `exif: false` only keeps EXIF out of the picker's JS result; it does not change the file.
 * Metadata removal comes from re-encoding the pixels during normalization.
 */
export async function pickProfilePhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new PhotoError('not_allowed', 'Allow photo access in Settings to add photos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    exif: false,
    base64: false,
    // Full quality: normalization re-encodes once, so the picker should not compress first.
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  try {
    return await normalizeProfilePhoto(asset.uri);
  } finally {
    // The picker's temporary copy of the original keeps its metadata (GPS included); it is
    // never uploaded, and is removed from the app cache once the normalized JPEG exists.
    discardPickerCopy(asset.uri);
  }
}

function discardPickerCopy(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort: the OS clears the cache directory eventually.
  }
}
