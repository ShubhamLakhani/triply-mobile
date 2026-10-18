import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Enter a valid email address.' })
  .max(254);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` })
  .max(72, { message: 'Use at most 72 characters.' });

export const credentialsSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict();

export type CredentialsInput = z.input<typeof credentialsSchema>;
