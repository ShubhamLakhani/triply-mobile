import { AppState, type AppStateStatus } from 'react-native';

import { getSupabaseClient } from './client';

/**
 * Supabase only refreshes tokens while the app is foregrounded on React Native.
 * Recommended pattern: start auto-refresh when active, stop when backgrounded.
 * Returns an unsubscribe function.
 */
export function registerSupabaseAutoRefresh(): () => void {
  const { auth } = getSupabaseClient();

  const handleState = (state: AppStateStatus) => {
    if (state === 'active') {
      void auth.startAutoRefresh();
    } else {
      void auth.stopAutoRefresh();
    }
  };

  handleState(AppState.currentState);
  const subscription = AppState.addEventListener('change', handleState);
  return () => subscription.remove();
}
