import { z } from 'zod';

import { MAX_INTERESTS } from '../types';

export const interestIdSchema = z.uuid({ message: 'Choose a valid interest.' });

/**
 * Full replacement list for replace_profile_interests (duplicates are collapsed). Only the
 * maximum is checked here: fewer than 3 is valid while onboarding is in progress, and the
 * database enforces the minimum once onboarding is complete.
 */
export const interestSelectionSchema = z
  .array(interestIdSchema)
  .transform((ids) => [...new Set(ids)])
  .refine((ids) => ids.length <= MAX_INTERESTS, `Choose up to ${MAX_INTERESTS} interests.`);

export type InterestSelectionInput = z.input<typeof interestSelectionSchema>;
