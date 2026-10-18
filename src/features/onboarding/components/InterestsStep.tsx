import { useState } from 'react';

import { RetryNotice } from '@/components/feedback/RetryNotice';
import { InterestPicker } from '@/features/interests/components/InterestPicker';
import { useInterestSelection } from '@/features/interests/hooks/use-interest-selection';

import { useOnboardingStep } from '../hooks/use-onboarding-step';

import { OnboardingShell } from './OnboardingShell';

/** Step 2: up to 10 interests (optional, atomic save). */
export function InterestsStep() {
  const { userId, advance, back } = useOnboardingStep('interests');
  const selection = useInterestSelection(userId);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      if (selection.isDirty) await selection.save();
      advance();
    } catch {
      setError('We couldn’t save your interests. Please try again.');
    }
  };

  return (
    <OnboardingShell
      step="interests"
      title="What are you into?"
      subtitle="Pick up to 10. They help you find people you’ll actually enjoy a day with."
      primaryLabel={
        selection.selectedIds.length === 0
          ? 'Continue'
          : `Continue with ${selection.selectedIds.length}`
      }
      onPrimary={() => void save()}
      primaryLoading={selection.isSaving}
      // Saving replaces the whole selection, so it needs the saved selection loaded first.
      primaryDisabled={selection.status !== 'ready'}
      secondaryLabel="Skip for now"
      onSecondary={() => advance({ skipped: true })}
      onBack={back}
      error={error}
      testID="onboarding-interests"
    >
      {selection.isError ? (
        <RetryNotice
          message="We couldn’t load interests. Try again, or skip and add them later from your profile."
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
