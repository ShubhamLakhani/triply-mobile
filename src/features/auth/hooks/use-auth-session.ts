import { useEffect, useState } from 'react';

import { captureError } from '@/services/observability';

import { getCurrentSession, subscribeToAuthChanges, type Session } from '../api/auth-api';

export interface AuthSessionState {
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
}

/**
 * Current Supabase session, kept in sync with auth state changes. Session data stays in
 * Supabase's own persisted store; it is not copied into Zustand.
 */
export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .catch((error: unknown) => captureError(error, { source: 'auth-session' }))
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const unsubscribe = subscribeToAuthChanges((_event, next) => {
      if (!active) return;
      setSession(next);
      setIsLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { session, userId: session?.user.id ?? null, isLoading };
}
