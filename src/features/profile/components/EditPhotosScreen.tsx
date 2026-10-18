import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { PhotoManager } from '@/features/photos/components/PhotoManager';

import { useOwnProfile } from '../hooks/use-own-profile';

import { EditScreenShell } from './EditScreenShell';

/** Photos save as you go, so this screen has no save button. */
export function EditPhotosScreen() {
  const { userId } = useAuthSession();
  const profile = useOwnProfile(userId);
  // A completed profile always keeps one photo (the database enforces it); only offer Replace.
  const protectLastPhoto = Boolean(profile.data?.onboarding_completed_at);
  return (
    <EditScreenShell
      title="Photos"
      subtitle="Your first photo is your main photo. Tap any photo to reorder, make it main, replace or remove it."
      testID="edit-photos"
    >
      <PhotoManager userId={userId} protectLastPhoto={protectLastPhoto} />
    </EditScreenShell>
  );
}
