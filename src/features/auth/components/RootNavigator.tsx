import { Stack } from 'expo-router';

import { captureError } from '@/services/observability';
import { colors } from '@/theme';

import { useAuthSession } from '../hooks/use-auth-session';
import { useAppArea } from '../routing/use-app-area';

import { BootstrapScreen } from './BootstrapScreen';

/**
 * Root navigator with route-group guards:
 *   signed out → (auth) · signed in + incomplete profile → onboarding · complete → (tabs).
 * While the session/profile are still resolving, a bootstrap screen is shown instead of the
 * navigator so no wrong group ever flashes. Guards are driven by the persisted profile row.
 * When a guard flips (e.g. onboarding finished), the active group is removed and the stack
 * falls back to `index`, which redirects to the new area's home.
 */
export function RootNavigator() {
  const { area, problem, retry } = useAppArea();
  const { signOut } = useAuthSession();

  if (area === 'bootstrap') return <BootstrapScreen />;
  if (area === 'error') {
    return (
      <BootstrapScreen
        problem={problem}
        onRetry={retry}
        onSignOut={() => {
          signOut().catch((error: unknown) => captureError(error, { source: 'sign-out' }));
        }}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Protected guard={area === 'auth'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={area === 'onboarding'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={area === 'app'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
