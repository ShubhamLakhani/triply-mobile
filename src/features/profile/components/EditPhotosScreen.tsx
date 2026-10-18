import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { PhotoManager } from '@/features/photos/components/PhotoManager';

import { EditScreenShell } from './EditScreenShell';

/** Photos save as you go, so this screen has no save button. */
export function EditPhotosScreen() {
  const { userId } = useAuthSession();
  return (
    <EditScreenShell
      title="Photos"
      subtitle="Your first photo is your main photo. Tap any photo to reorder, make it main or remove it."
      testID="edit-photos"
    >
      <PhotoManager userId={userId} />
    </EditScreenShell>
  );
}
