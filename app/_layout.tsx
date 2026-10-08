// Per-weight imports so only the four weights we use are bundled (not all 18 Inter files).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { ConfigErrorScreen } from '@/components/feedback/ConfigErrorScreen';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { loadEnv } from '@/config/env';
import { AppProviders } from '@/providers/AppProviders';
import { captureError, initObservability, wrapRootComponent } from '@/services/observability';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const envResult = loadEnv();
if (envResult.ok) {
  initObservability(envResult.env);
}

/** Expo Router route-level error boundary: report, then offer a calm retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { source: 'route-error-boundary' });
  }, [error]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fill}>
        <ErrorFallback onRetry={() => void retry()} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) captureError(fontError, { source: 'font-loading' });
  }, [fontError]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (!envResult.ok) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.fill}>
          <StatusBar style="dark" />
          <ConfigErrorScreen issues={envResult.issues} showDetails={__DEV__} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <AppProviders env={envResult.env}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
});

export default wrapRootComponent(RootLayout);
