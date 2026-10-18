import { router } from 'expo-router';
import { useState } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';
import { RetryNotice } from '@/components/feedback/RetryNotice';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { PreferencesFields } from '@/features/preferences/components/PreferencesFields';
import { usePreferencesDraft } from '@/features/preferences/hooks/use-preferences-draft';

import { EditScreenShell } from './EditScreenShell';

export function EditPreferencesScreen() {
  const { userId } = useAuthSession();
  const prefs = usePreferencesDraft(userId);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await prefs.save();
      router.back();
    } catch {
      setError('We couldn’t save your preferences. Please try again.');
    }
  };

  return (
    <EditScreenShell
      title="Discovery preferences"
      onSave={() => void save()}
      saving={prefs.isSaving}
      // Only values loaded from the server can be edited and saved (never defaults).
      saveDisabled={prefs.status !== 'ready' || !prefs.isDirty}
      error={error}
      testID="edit-preferences"
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
          message="We couldn’t load your preferences. Check your connection and try again."
          onRetry={prefs.retry}
          retrying={prefs.isRetrying}
          testID="preferences-load-error"
        />
      ) : (
        <LoadingState label="Loading your preferences" />
      )}
    </EditScreenShell>
  );
}
