import { Redirect } from 'expo-router';

/**
 * Entry route.
 * Phase 0M: no auth yet, go straight to the tab shell.
 * Phase 1M: replace with session-aware routing (Stack.Protected guards for auth/onboarding/tabs).
 */
export default function Index() {
  return <Redirect href="/discover" />;
}
