import { useState } from 'react';

import {
  ProfileBasicsFields,
  useProfileBasicsForm,
} from '@/features/profile/components/ProfileBasicsFields';
import { profileErrorMessage } from '@/features/profile/components/profile-messages';
import { useUpdateProfile } from '@/features/profile/hooks/use-own-profile';
import { toProfileUpdate } from '@/features/profile/schemas/profile-form.schema';

import { useOnboardingStep } from '../hooks/use-onboarding-step';
import { markOnboardingStarted } from '../progress';

import { OnboardingShell } from './OnboardingShell';

/** Step 1: the details the database needs for a complete (18+) profile. */
export function ProfileStep() {
  const { userId, profile, advance } = useOnboardingStep('profile');
  const update = useUpdateProfile(userId);
  const form = useProfileBasicsForm(profile.data);
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    // Mark onboarding as in progress BEFORE the save: the saved row (cached as soon as the
    // mutation succeeds) can make the account look complete, and without the marker the root
    // guard would briefly route to the tabs. If the save fails the marker is harmless: an
    // incomplete profile always resumes at this step, and if the write did land the user
    // correctly continues with the optional steps.
    if (userId) markOnboardingStarted(userId);
    try {
      const saved = await update.mutateAsync(toProfileUpdate(values));
      if (!saved.is_profile_complete) {
        setError(
          'Your profile isn’t complete yet. Make sure your name, date of birth (18+) and gender are filled in.',
        );
        return;
      }
      advance();
    } catch (cause) {
      setError(profileErrorMessage(cause));
    }
  });

  return (
    <OnboardingShell
      step="profile"
      title="Let’s start with you"
      subtitle="Just the essentials for now — you can add more later."
      primaryLabel="Continue"
      onPrimary={() => void submit()}
      primaryLoading={update.isPending}
      onBack={false}
      error={error}
      testID="onboarding-profile"
    >
      <ProfileBasicsFields form={form} compact />
    </OnboardingShell>
  );
}
