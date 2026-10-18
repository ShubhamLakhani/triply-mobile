import { router } from 'expo-router';
import { useState } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';
import { RetryNotice } from '@/components/feedback/RetryNotice';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';

import { useOwnProfile, useUpdateProfile } from '../hooks/use-own-profile';
import { toProfileUpdate } from '../schemas/profile-form.schema';
import type { Profile } from '../types';

import { EditScreenShell } from './EditScreenShell';
import { profileErrorMessage } from './profile-messages';
import { ProfileBasicsFields, useProfileBasicsForm } from './ProfileBasicsFields';

/** Mounted only with a loaded row, so the form's defaults are always the saved values. */
function EditProfileForm({ userId, profile }: { userId: string | null; profile: Profile }) {
  const update = useUpdateProfile(userId);
  const form = useProfileBasicsForm(profile);
  const [error, setError] = useState<string | null>(null);
  // The database locks the date of birth once onboarding is complete.
  const dobLocked = profile.onboarding_completed_at !== null;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await update.mutateAsync(toProfileUpdate(values, { dobLocked }));
      router.back();
    } catch (cause) {
      setError(profileErrorMessage(cause));
    }
  });

  return (
    <EditScreenShell
      title="Edit profile"
      onSave={() => void submit()}
      saving={update.isPending}
      error={error}
      testID="edit-profile"
    >
      <ProfileBasicsFields form={form} dobLocked={dobLocked} />
    </EditScreenShell>
  );
}

export function EditProfileScreen() {
  const { userId } = useAuthSession();
  const profile = useOwnProfile(userId);

  if (profile.data) return <EditProfileForm userId={userId} profile={profile.data} />;
  return (
    <EditScreenShell title="Edit profile" testID="edit-profile">
      {profile.isError ? (
        <RetryNotice
          message="We couldn’t load your profile. Check your connection and try again."
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
          testID="profile-load-error"
        />
      ) : (
        <LoadingState label="Loading your profile" />
      )}
    </EditScreenShell>
  );
}
