import { z } from 'zod';

/**
 * Reusable primitive schemas. Feature schemas compose these; screens never define validation inline.
 * The backend re-validates everything (Architecture v2 §8).
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }));

export const uuidSchema = z.uuid();

export const nonEmptyTrimmedString = (maxLength: number) =>
  z.string().trim().min(1, 'This field is required.').max(maxLength);
