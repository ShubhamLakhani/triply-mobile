import { z } from 'zod';

import { createUserDraftStore } from '@/services/storage/user-draft-store';

import { interestIdSchema } from './schemas/interest.schema';
import { MAX_INTERESTS } from './types';

/**
 * The onboarding interests step's unsaved selection, kept per user on the device so a cold
 * restart resumes with the same chips. Cleared once the server save succeeds and when
 * onboarding completes. The profile edit screen does not use it (an abandoned edit is dropped).
 */
export const onboardingInterestsDraft = createUserDraftStore(
  'onboarding.interests',
  z.array(interestIdSchema).max(MAX_INTERESTS),
);
