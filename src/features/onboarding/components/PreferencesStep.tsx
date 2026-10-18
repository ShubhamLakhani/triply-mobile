import { useState } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';
import { RetryNotice } from '@/components/feedback/RetryNotice';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { PreferencesFields } from '@/features/preferences/components/PreferencesFields';
import { usePreferencesDraft } from '@/features/preferences/hooks/use-preferences-draft';

import { useOnboardingStep } from '../hooks/use-onboarding-step';

import { OnboardingShell } from './OnboardingShell';

/**
 * Step 3: who to meet, age range, minimum overlap. Defaults already exist server-side, so if
 * they cannot be loaded the user can retry or skip, but never save values they were not shown.
 */
export function PreferencesStep() {
  const { userId, advance, back } = useOnboardingStep('preferences');
  const prefs = usePreferencesDraft(userId);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await prefs.save();
      advance();
    } catch {
      setError('We couldn’t save your preferences. Please try again.');
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
      primaryDisabled={prefs.status !== 'ready'}
      secondaryLabel={prefs.isError ? 'Skip for now' : undefined}
      onSecondary={prefs.isError ? () => advance({ skipped: true }) : undefined}
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
          <PreferencesFields value={prefs.value} onChange={prefs.setValue} />
        </>
      ) : prefs.isError ? (
        <RetryNotice
          message="We couldn’t load your preferences. Try again, or skip and set them later from your profile."
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
