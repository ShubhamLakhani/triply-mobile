import { Redirect } from 'expo-router';

import { useAppArea } from '@/features/auth/routing/use-app-area';
import { BootstrapScreen } from '@/features/auth/components/BootstrapScreen';

/**
 * Entry + anchor route. The root layout's guards decide which group is mounted; this screen
 * sends the user to the right place inside it (and to the onboarding step they should resume).
 */
export default function Index() {
  const { area, home } = useAppArea();
  if (area === 'bootstrap' || area === 'error' || !home) return <BootstrapScreen />;
  return <Redirect href={home as never} />;
}
