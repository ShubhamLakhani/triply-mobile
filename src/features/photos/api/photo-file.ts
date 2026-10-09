import { File } from 'expo-file-system';

/** Reads a local (picker) file into memory for upload. Isolated for testability. */
export async function readLocalPhoto(localUri: string): Promise<ArrayBuffer> {
  return new File(localUri).arrayBuffer();
}

interface UuidSources {
  crypto?: { randomUUID?: () => string };
  expo?: { uuidv4?: () => string };
}

/**
 * New photo id (UUID v4). Uses `crypto.randomUUID` when the runtime has it, otherwise the native
 * generator Expo installs on `globalThis.expo` (no extra dependency).
 */
export function newPhotoId(): string {
  const sources = globalThis as unknown as UuidSources;
  // Call as methods: randomUUID must keep `this` bound to the Crypto object.
  if (typeof sources.crypto?.randomUUID === 'function') return sources.crypto.randomUUID();
  if (typeof sources.expo?.uuidv4 === 'function') return sources.expo.uuidv4();
  throw new Error('No UUID generator available.');
}
