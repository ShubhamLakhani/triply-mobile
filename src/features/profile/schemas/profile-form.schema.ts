import { z } from 'zod';

import { isAdult, isFutureDate, MINIMUM_AGE } from '../age';
import { BIO_MAX_LENGTH, GENDERS, type Gender } from '../types';

import type { ProfileUpdateInput } from './profile.schema';

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer.`);

const digits = (label: string, len: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,${len}}$`), `Enter a valid ${label}.`);

/**
 * UI form model for the basic profile step. Date of birth is entered as three fields (day,
 * month, year) which avoids a native date-picker dependency and matches well-known form
 * patterns. Output is a `ProfileUpdateInput` the existing API validates again.
 */
export const profileBasicsFormSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(1, 'Tell us your first name.')
      .max(80, 'Must be 80 characters or fewer.'),
    dob_day: digits('day', 2),
    dob_month: digits('month', 2),
    dob_year: digits('year', 4),
    gender: z.enum(GENDERS, { message: 'Choose an option.' }),
    bio: optionalText(BIO_MAX_LENGTH),
    home_city: optionalText(120),
    home_country: optionalText(120),
    occupation: optionalText(120),
  })
  .superRefine((value, ctx) => {
    const iso = toIsoDateOfBirth(value.dob_year, value.dob_month, value.dob_day);
    if (!iso) {
      ctx.addIssue({ code: 'custom', path: ['dob_day'], message: 'Enter a valid date of birth.' });
      return;
    }
    if (isFutureDate(iso)) {
      ctx.addIssue({
        code: 'custom',
        path: ['dob_day'],
        message: 'Date of birth can’t be in the future.',
      });
      return;
    }
    if (!isAdult(iso)) {
      ctx.addIssue({
        code: 'custom',
        path: ['dob_day'],
        message: `You need to be ${MINIMUM_AGE} or over to use Triply.`,
      });
    }
  });

export type ProfileBasicsFormValues = z.input<typeof profileBasicsFormSchema>;

/** Builds a validated YYYY-MM-DD string or null (rejects 31 February etc.). */
export function toIsoDateOfBirth(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Form values → profile update. With `dobLocked` (onboarding complete: the database rejects any
 * change) the date of birth is left out of the payload entirely.
 */
export function toProfileUpdate(
  values: z.output<typeof profileBasicsFormSchema>,
  options: { dobLocked?: boolean } = {},
): ProfileUpdateInput {
  return {
    first_name: values.first_name,
    ...(options.dobLocked
      ? {}
      : { date_of_birth: toIsoDateOfBirth(values.dob_year, values.dob_month, values.dob_day) }),
    gender: values.gender as Gender,
    bio: values.bio || null,
    home_city: values.home_city || null,
    home_country: values.home_country || null,
    occupation: values.occupation || null,
  };
}

/** Pre-fills the form from an existing profile row. */
export function toFormValues(
  profile:
    | {
        first_name: string | null;
        date_of_birth: string | null;
        gender: string | null;
        bio: string | null;
        home_city: string | null;
        home_country: string | null;
        occupation: string | null;
      }
    | null
    | undefined,
): ProfileBasicsFormValues {
  const [year = '', month = '', day = ''] = profile?.date_of_birth?.split('-') ?? [];
  return {
    first_name: profile?.first_name ?? '',
    dob_day: day,
    dob_month: month,
    dob_year: year,
    gender: (profile?.gender as Gender | null) ?? ('' as Gender),
    bio: profile?.bio ?? '',
    home_city: profile?.home_city ?? '',
    home_country: profile?.home_country ?? '',
    occupation: profile?.occupation ?? '',
  };
}
