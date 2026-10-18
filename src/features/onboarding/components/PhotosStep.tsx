import { PhotoManager } from '@/features/photos/components/PhotoManager';
import { useOwnProfilePhotos } from '@/features/photos/hooks/use-profile-photos';

import { useOnboardingStep } from '../hooks/use-onboarding-step';

import { OnboardingShell } from './OnboardingShell';

/** Step 4: at least one photo (required to complete onboarding; the first becomes the main one). */
export function PhotosStep() {
  const { userId, advance, back } = useOnboardingStep('photos');
  const photos = useOwnProfilePhotos(userId);
  const count = photos.data?.length ?? 0;

  return (
    <OnboardingShell
      step="photos"
      title="Show your travel side"
      subtitle="Clear, recent photos of you get the best responses. Profiles with photos are seen first."
      primaryLabel={count > 0 ? 'Continue' : 'Add a photo'}
      onPrimary={count > 0 ? () => advance() : () => undefined}
      primaryDisabled={count === 0}
      onBack={back}
      testID="onboarding-photos"
    >
      <PhotoManager userId={userId} />
    </OnboardingShell>
  );
}
