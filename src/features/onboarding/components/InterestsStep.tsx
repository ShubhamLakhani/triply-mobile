import { useState } from 'react';

import { RetryNotice } from '@/components/feedback/RetryNotice';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { InterestPicker } from '@/features/interests/components/InterestPicker';
import { onboardingInterestsDraft } from '@/features/interests/drafts';
import { useInterestSelection } from '@/features/interests/hooks/use-interest-selection';
import { MAX_INTERESTS, MIN_INTERESTS } from '@/features/interests/types';
import { interestErrorMessage } from '@/features/profile/components/profile-messages';

import { useOnboardingStep } from '../hooks/use-onboarding-step';

import { OnboardingShell } from './OnboardingShell';

/**
 * Step 2: 3–8 interests (required to complete onboarding; atomic save). The unsaved selection
 * is kept per user on the device, so a force-close before Continue resumes with the same chips.
 */
export function InterestsStep() {
  const { userId, advance, back } = useOnboardingStep('interests');
  const selection = useInterestSelection(userId, { draftStore: onboardingInterestsDraft });
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await selection.save();
      advance();
    } catch (cause) {
      setError(interestErrorMessage(cause));
    }
  };
  const count = selection.selectedIds.length;

  return (
    <OnboardingShell
      step="interests"
      title="What are you into?"
      subtitle={`Pick ${MIN_INTERESTS} to ${MAX_INTERESTS}. They help you find people you’ll actually enjoy a day with.`}
      primaryLabel={
        count < MIN_INTERESTS ? `Pick ${MIN_INTERESTS - count} more` : `Continue with ${count}`
      }
      onPrimary={() => void save()}
      primaryLoading={selection.isSaving}
      // Saving replaces the whole selection, so it needs the saved selection loaded first.
      primaryDisabled={selection.status !== 'ready' || !selection.meetsMinimum}
      onBack={back}
      error={error}
      testID="onboarding-interests"
    >
      {selection.draftPersistFailed ? (
        <InlineMessage
          tone="error"
          message="We couldn’t keep a copy of your picks on this device. Tap Continue to save them to your account."
          testID="interests-draft-error"
        />
      ) : null}
      {selection.isError ? (
        <RetryNotice
          message="We couldn’t load interests. Check your connection and try again."
          onRetry={selection.retry}
          retrying={selection.isRetrying}
          testID="interests-load-error"
        />
      ) : (
        <InterestPicker
          catalog={selection.status === 'ready' ? selection.catalog : undefined}
          selectedIds={selection.selectedIds}
          onToggle={selection.toggle}
          isLoading={selection.isLoading}
          testID="interest-picker"
        />
      )}
    </OnboardingShell>
  );
}
