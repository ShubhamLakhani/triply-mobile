import { z } from 'zod';

import { createUserDraftStore } from '@/services/storage/user-draft-store';

import type { ProfileBasicsFormValues } from './schemas/profile-form.schema';
import { GENDERS, type Gender } from './types';

const digits = (max: number) => z.string().regex(new RegExp(`^\\d{0,${max}}$`));

/**
 * The onboarding profile step's unsaved input, exactly as typed (a half-entered date is
 * restorable too). Only the fields that step shows: the hidden "about you" fields keep coming
 * from the server row, so a stale draft can never overwrite them.
 */
export const profileBasicsDraftSchema = z
  .object({
    first_name: z.string().max(80),
    dob_day: digits(2),
    dob_month: digits(2),
    dob_year: digits(4),
    gender: z.enum(GENDERS).or(z.literal('')),
  })
  .strict();

export type ProfileBasicsDraft = z.infer<typeof profileBasicsDraftSchema>;

/**
 * Kept per user on the device so a cold restart resumes the profile step with the same input.
 * Cleared once the profile save succeeds and when onboarding completes. The profile edit screen
 * does not use it (an abandoned edit is dropped).
 */
export const onboardingProfileDraft = createUserDraftStore(
  'onboarding.profile',
  profileBasicsDraftSchema,
);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Picks the drafted fields out of the live form values (react-hook-form `watch`). */
export function toProfileBasicsDraft(
  values: Partial<Record<keyof ProfileBasicsFormValues, unknown>>,
): ProfileBasicsDraft {
  const gender = text(values.gender);
  return {
    first_name: text(values.first_name),
    dob_day: text(values.dob_day),
    dob_month: text(values.dob_month),
    dob_year: text(values.dob_year),
    gender: (GENDERS as readonly string[]).includes(gender) ? (gender as Gender) : '',
  };
}

/** A restored draft as form default values (overlaid on the server row). */
export function draftToFormValues(draft: ProfileBasicsDraft): Partial<ProfileBasicsFormValues> {
  return { ...draft, gender: draft.gender as Gender };
}
