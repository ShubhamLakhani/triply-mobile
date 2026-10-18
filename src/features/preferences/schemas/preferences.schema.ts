import { z } from 'zod';

import { GENDERS } from '@/features/profile/types';

import { PREFERENCE_LIMITS as L } from '../types';

const age = z
  .number()
  .int()
  .min(L.minAge, `Must be at least ${L.minAge}.`)
  .max(L.maxAge, `Must be ${L.maxAge} or less.`);

/**
 * Editable discovery preferences. Owner and timestamps are rejected by `.strict()`.
 * If only one age bound changes, the database checks it against the stored bound.
 */
export const discoveryPreferencesUpdateSchema = z
  .object({
    min_age: age,
    max_age: age,
    minimum_overlap_days: z
      .number()
      .int()
      .min(L.minOverlapDays, `At least ${L.minOverlapDays} day.`)
      .max(L.maxOverlapDays, `At most ${L.maxOverlapDays} days.`),
  })
  .partial()
  .strict()
  .refine((p) => p.min_age === undefined || p.max_age === undefined || p.max_age >= p.min_age, {
    message: 'Maximum age must be at least the minimum age.',
    path: ['max_age'],
  });

/**
 * Full gender preference list (empty = not configured). Duplicates are collapsed. Canonical
 * values only: the UI's "Everyone" is sent as every value.
 */
export const genderPreferencesSchema = z
  .array(z.enum(GENDERS, { message: 'Choose a valid option.' }))
  .transform((values) => [...new Set(values)]);

export type DiscoveryPreferencesUpdateInput = z.input<typeof discoveryPreferencesUpdateSchema>;
export type GenderPreferencesInput = z.input<typeof genderPreferencesSchema>;
