import { router } from 'expo-router';
import { useState } from 'react';

import { RetryNotice } from '@/components/feedback/RetryNotice';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { InterestPicker } from '@/features/interests/components/InterestPicker';
import { useInterestSelection } from '@/features/interests/hooks/use-interest-selection';

import { EditScreenShell } from './EditScreenShell';

export function EditInterestsScreen() {
  const { userId } = useAuthSession();
  const selection = useInterestSelection(userId);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await selection.save();
      router.back();
    } catch {
      setError('We couldn’t save your interests. Please try again.');
    }
  };

  return (
    <EditScreenShell
      title="Interests"
      subtitle="Pick up to 10."
      onSave={() => void save()}
      saving={selection.isSaving}
      // Saving replaces the whole selection: only allowed once the saved one has loaded.
      saveDisabled={selection.status !== 'ready' || !selection.isDirty}
      error={error}
      testID="edit-interests"
    >
      {selection.isStale ? (
        <InlineMessage
          tone="info"
          message="Showing your last saved interests. We couldn’t refresh them just now."
        />
      ) : null}
      {selection.isError ? (
        <RetryNotice
          message="We couldn’t load your interests. Check your connection and try again."
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
    </EditScreenShell>
  );
}
