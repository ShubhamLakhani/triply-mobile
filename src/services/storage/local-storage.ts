/**
 * Device key-value persistence.
 *
 * Uses Expo's `expo-sqlite` localStorage implementation, the storage Expo currently recommends for
 * Supabase auth session persistence in React Native (docs.expo.dev/guides/using-supabase).
 * The side-effect import installs a synchronous, Web-compatible `globalThis.localStorage`.
 *
 * Do not store secrets or sensitive personal content here beyond the auth session that the
 * Supabase client manages itself.
 */
import 'expo-sqlite/localStorage/install';

export function getDeviceLocalStorage(): Storage {
  return globalThis.localStorage;
}
