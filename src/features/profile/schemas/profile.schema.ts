import { z } from 'zod';

import { isAdult, isFutureDate, MINIMUM_AGE } from '../age';
import { BIO_MAX_LENGTH, GENDERS } from '../types';

/** Trimmed optional text; empty becomes null (mirrors private.normalize_text). */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const dateOfBirthSchema = z.iso
  .date({ message: 'Enter a valid date of birth.' })
  .refine((value) => value >= '1900-01-01', 'Enter a valid date of birth.')
  .refine((value) => !isFutureDate(value), 'Date of birth cannot be in the future.')
  .refine((value) => isAdult(value), `You must be at least ${MINIMUM_AGE} to use Triply.`)
  .nullable();

/**
 * Editable own-profile fields. `.strict()` rejects protected columns (id, created_at,
 * updated_at, is_profile_complete, onboarding_completed_at, discovery_paused_at,
 * is_discoverable) before a request is ever made. The database enforces the same rules
 * independently; this schema exists for UX and type safety.
 */
export const profileUpdateSchema = z
  .object({
    first_name: nullableText(80),
    date_of_birth: dateOfBirthSchema,
    gender: z.enum(GENDERS, { message: 'Choose an option.' }).nullable(),
    bio: nullableText(BIO_MAX_LENGTH),
    home_city: nullableText(120),
    home_country: nullableText(120),
    occupation: nullableText(120),
  })
  .partial()
  .strict();

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdatePayload = z.output<typeof profileUpdateSchema>;
