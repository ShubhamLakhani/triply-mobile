import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';

interface NetworkSnapshot {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

/** Unknown reachability (undefined) is treated as online so we don't block on a cold start. */
export function isOnline(state: NetworkSnapshot): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Connects TanStack Query to React Native lifecycle (recommended RN integration):
 * - AppState 'active' → focused (refetch stale queries when returning to the app)
 * - expo-network reachability → online/offline (pause & resume queries/mutations)
 * Returns a cleanup function.
 */
export function setupQueryManagers(): () => void {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => setOnline(isOnline(state)));
    return () => subscription.remove();
  });

  const onAppStateChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

  return () => {
    appStateSubscription.remove();
  };
}
