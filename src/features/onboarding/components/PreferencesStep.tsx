import { useState } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';
import { RetryNotice } from '@/components/feedback/RetryNotice';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { PreferencesFields } from '@/features/preferences/components/PreferencesFields';
import { onboardingPreferencesDraft } from '@/features/preferences/drafts';
import { usePreferencesDraft } from '@/features/preferences/hooks/use-preferences-draft';
import { preferenceErrorMessage } from '@/features/profile/components/profile-messages';

import { useOnboardingStep } from '../hooks/use-onboarding-step';

import { OnboardingShell } from './OnboardingShell';

/**
 * Step 3: who to meet (at least one, or Everyone), age range, minimum overlap. Required to
 * complete onboarding. If the saved values cannot be loaded the user can only retry: nothing
 * they were not shown is ever saved. Unsaved edits are kept per user on the device, so a
 * force-close before Continue resumes with the same values.
 */
export function PreferencesStep() {
  const { userId, advance, back } = useOnboardingStep('preferences');
  const prefs = usePreferencesDraft(userId, { draftStore: onboardingPreferencesDraft });
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await prefs.save();
      advance();
    } catch (cause) {
      setError(preferenceErrorMessage(cause));
    }
  };

  return (
    <OnboardingShell
      step="preferences"
      title="Who would you like to meet?"
      subtitle="You can change any of this later."
      primaryLabel="Continue"
      onPrimary={() => void save()}
      primaryLoading={prefs.isSaving}
      primaryDisabled={prefs.status !== 'ready' || !prefs.meetsMinimum}
      onBack={back}
      error={error}
      testID="onboarding-preferences"
    >
      {prefs.value ? (
        <>
          {prefs.isStale ? (
            <InlineMessage
              tone="info"
              message="Showing your last saved preferences. We couldn’t refresh them just now."
            />
          ) : null}
          {prefs.draftPersistFailed ? (
            <InlineMessage
              tone="error"
              message="We couldn’t keep a copy of your choices on this device. Tap Continue to save them to your account."
              testID="preferences-draft-error"
            />
          ) : null}
          <PreferencesFields value={prefs.value} onChange={prefs.setValue} />
        </>
      ) : prefs.isError ? (
        <RetryNotice
          message="We couldn’t load your preferences. Check your connection and try again."
          onRetry={prefs.retry}
          retrying={prefs.isRetrying}
          testID="preferences-load-error"
        />
      ) : (
        <LoadingState label="Loading your preferences" />
      )}
    </OnboardingShell>
  );
}
