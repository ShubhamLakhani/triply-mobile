import { router } from 'expo-router';

import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';
import { AppButton } from '@/components/ui/AppButton';

export default function SignInPlaceholder() {
  return (
    <PlaceholderScreen
      testID="sign-in-placeholder"
      title="Sign in"
      description="Email sign-in with Supabase Auth, deep-link callbacks and persistent sessions."
      plannedPhase="Phase 1M"
    >
      <AppButton label="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}
