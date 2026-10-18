import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

/** Digits in the email verification / recovery code (Supabase Auth `otp_length`). */
export const EMAIL_CODE_LENGTH = 6;

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

/** Exactly six digits; spaces (e.g. from a pasted "123 456") are ignored. */
export const emailCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(
    z
      .string()
      .regex(
        new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`),
        `Enter the ${EMAIL_CODE_LENGTH}-digit code.`,
      ),
  );

export const emailCodeInputSchema = z
  .object({ email: emailSchema, code: emailCodeSchema })
  .strict();

export type EmailCodeInput = z.input<typeof emailCodeInputSchema>;

/** New password + confirmation (password reset). Same rules as sign-up. */
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .strict()
  .refine((value) => value.password === value.confirm, {
    message: 'Passwords don’t match.',
    path: ['confirm'],
  });

export type NewPasswordInput = z.input<typeof newPasswordSchema>;
