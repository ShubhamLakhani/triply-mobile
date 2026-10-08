import { router } from 'expo-router';

import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';
import { AppButton } from '@/components/ui/AppButton';

export default function OnboardingStartPlaceholder() {
  return (
    <PlaceholderScreen
      testID="onboarding-placeholder"
      title="Onboarding"
      description="Identity, 18+ check, photos, bio, preferences and first trip — resumable."
      plannedPhase="Phase 2M"
    >
      <AppButton label="Back" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}
