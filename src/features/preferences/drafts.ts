import { createUserDraftStore } from '@/services/storage/user-draft-store';

import { preferencesDraftSchema } from './schemas/preferences.schema';

/**
 * The onboarding preferences step's unsaved values, kept per user on the device so a cold
 * restart resumes with the same choices. Cleared once the server save succeeds and when
 * onboarding completes. The profile edit screen does not use it (an abandoned edit is dropped).
 */
export const onboardingPreferencesDraft = createUserDraftStore(
  'onboarding.preferences',
  preferencesDraftSchema,
);
