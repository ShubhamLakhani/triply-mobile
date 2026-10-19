import { useEffect, useState } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';
import { InlineMessage } from '@/components/ui/InlineMessage';
import {
  ProfileBasicsFields,
  useProfileBasicsForm,
} from '@/features/profile/components/ProfileBasicsFields';
import { profileErrorMessage } from '@/features/profile/components/profile-messages';
import {
  draftToFormValues,
  onboardingProfileDraft,
  toProfileBasicsDraft,
} from '@/features/profile/drafts';
import { useUpdateProfile } from '@/features/profile/hooks/use-own-profile';
import { toProfileUpdate } from '@/features/profile/schemas/profile-form.schema';
import type { Profile } from '@/features/profile/types';

import { useOnboardingStep } from '../hooks/use-onboarding-step';

import { OnboardingShell } from './OnboardingShell';

interface ProfileStepFormProps {
  userId: string | null;
  profile: Profile;
  advance: () => void;
}

/**
 * Mounted only with the loaded server row, so the form defaults are the saved values with the
 * device draft (what was typed before a force-close) on top. Every change is written to the
 * per-user draft; it is dropped only once the server accepted the save.
 */
function ProfileStepForm({ userId, profile, advance }: ProfileStepFormProps) {
  const update = useUpdateProfile(userId);
  // Read once per mount: after that react-hook-form owns the live values.
  const [draft] = useState(() => (userId ? onboardingProfileDraft.read(userId) : null));
  const form = useProfileBasicsForm(profile, draft ? draftToFormValues(draft) : null);
  const [error, setError] = useState<string | null>(null);
  const [draftPersistFailed, setDraftPersistFailed] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    const subscription = form.watch((values) => {
      if (!onboardingProfileDraft.write(userId, toProfileBasicsDraft(values))) {
        setDraftPersistFailed(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, userId]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    // A complete core profile does not finish onboarding: only complete_onboarding() on the
    // Ready step does (server timestamp), so saving here never routes to the tabs.
    try {
      const saved = await update.mutateAsync(toProfileUpdate(values));
      if (!saved.is_profile_complete) {
        setError(
          'Your profile isn’t complete yet. Make sure your name, date of birth (18+) and gender are filled in.',
        );
        return;
      }
      // The server has it now; a restart resumes from the row, not the draft.
      if (userId) onboardingProfileDraft.clear(userId);
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
      {draftPersistFailed ? (
        <InlineMessage
          tone="error"
          message="We couldn’t keep a copy of your details on this device. Tap Continue to save them to your account."
          testID="profile-draft-error"
        />
      ) : null}
      <ProfileBasicsFields form={form} compact />
    </OnboardingShell>
  );
}

/** Step 1: the details the database needs for a complete (18+) profile. */
export function ProfileStep() {
  const { userId, profile, advance } = useOnboardingStep('profile');

  if (!profile.data) {
    // The root guard only shows onboarding once the row is loaded; this is a safety net.
    return (
      <OnboardingShell
        step="profile"
        title="Let’s start with you"
        subtitle="Just the essentials for now — you can add more later."
        primaryLabel="Continue"
        onPrimary={() => undefined}
        primaryDisabled
        onBack={false}
        testID="onboarding-profile"
      >
        <LoadingState label="Loading your profile" />
      </OnboardingShell>
    );
  }

  return <ProfileStepForm userId={userId} profile={profile.data} advance={advance} />;
}
