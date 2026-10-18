import { Stack } from 'expo-router';

import { RestrictedAccountScreen } from '@/features/account/components/RestrictedAccountScreen';
import { captureError } from '@/services/observability';
import { colors } from '@/theme';

import { useAuthSession } from '../hooks/use-auth-session';
import { useAppArea } from '../routing/use-app-area';

import { BootstrapScreen } from './BootstrapScreen';

/**
 * Root navigator with route-group guards:
 *   signed out → (auth) · inactive account → restricted screen ·
 *   onboarding not completed on the server → onboarding · completed → (tabs).
 * While the session/account/profile are still resolving, a bootstrap screen is shown instead
 * of the navigator so no wrong group ever flashes. Guards are driven by server state
 * (account_states + profiles.onboarding_completed_at). When a guard flips (e.g. onboarding
 * completed), the active group is removed and the stack falls back to `index`, which redirects
 * to the new area's home.
 */
export function RootNavigator() {
  const { area, problem, account, retry } = useAppArea();
  const { signOut } = useAuthSession();
  const signOutSafely = () => {
    signOut().catch((error: unknown) => captureError(error, { source: 'sign-out' }));
  };

  if (area === 'bootstrap') return <BootstrapScreen />;
  if (area === 'restricted' && account && account.status !== 'active') {
    return (
      <RestrictedAccountScreen
        state={{ ...account, status: account.status }}
        onSignOut={signOutSafely}
      />
    );
  }
  if (area === 'error') {
    return <BootstrapScreen problem={problem} onRetry={retry} onSignOut={signOutSafely} />;
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
