import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppEnv } from '@/config/env';
import { AnalyticsProvider, createAppAnalytics } from '@/services/analytics';
import { configureNotificationHandling } from '@/services/notifications';
import { createQueryClient, setupQueryManagers } from '@/services/query';
import { registerSupabaseAutoRefresh } from '@/services/supabase';

export interface AppProvidersProps {
  env: AppEnv;
  children: ReactNode;
}

/**
 * Root provider composition. Order matters:
 * GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → AnalyticsProvider.
 */
export function AppProviders({ env, children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  const [analytics] = useState(() => createAppAnalytics(env));

  useEffect(() => setupQueryManagers(), []);
  useEffect(() => registerSupabaseAutoRefresh(), []);
  useEffect(() => {
    // Foreground presentation policy only — this never prompts for permission.
    configureNotificationHandling();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AnalyticsProvider client={analytics}>{children}</AnalyticsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
