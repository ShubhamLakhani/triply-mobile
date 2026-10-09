import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/supabase';

export type { AuthChangeEvent, Session, User };

/**
 * Locally persisted session (expo-sqlite localStorage), refreshed automatically while the
 * app is foregrounded. Use for routing decisions; do not trust it for authorization.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Verifies the session with Supabase Auth (network). Returns null when signed out. */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError') return null;
    throw error;
  }
  return data.user;
}

/** Subscribes to sign-in / sign-out / token refresh events. Returns an unsubscribe function. */
export function subscribeToAuthChanges(
  listener: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange(listener);
  return () => subscription.unsubscribe();
}
