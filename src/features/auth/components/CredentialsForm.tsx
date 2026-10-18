import { useRef, useState } from 'react';
import { Controller, useFormState } from 'react-hook-form';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AppInput } from '@/components/forms/AppInput';
import { FormField } from '@/components/forms/FormField';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { useZodForm } from '@/hooks/use-zod-form';
import { spacing } from '@/theme';

import { AppAuthError } from '../api/auth-errors';
import {
  credentialsSchema,
  PASSWORD_MIN_LENGTH,
  type CredentialsInput,
} from '../schemas/auth.schema';

export interface CredentialsFormProps {
  mode: 'sign-in' | 'sign-up';
  onSubmit: (values: CredentialsInput) => Promise<void>;
  initialEmail?: string;
}

export function authErrorMessage(error: unknown): string {
  return error instanceof AppAuthError ? error.message : 'Something went wrong. Please try again.';
}

/** Email + password form shared by sign-in and sign-up, with a show/hide password toggle. */
export function CredentialsForm({ mode, onSubmit, initialEmail = '' }: CredentialsFormProps) {
  const form = useZodForm(credentialsSchema, {
    defaultValues: { email: initialEmail, password: '' },
  });
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Explicit subscription (React Compiler-safe; see ProfileBasicsFields).
  const { isSubmitting, isValid, isSubmitted } = useFormState({ control: form.control });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values);
    } catch (cause) {
      setError(authErrorMessage(cause));
    }
  });

  return (
    <View style={styles.form}>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label="Email" error={fieldState.error?.message}>
            <AppInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              invalid={Boolean(fieldState.error)}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
              testID="auth-email"
            />
          </FormField>
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField
            label="Password"
            error={fieldState.error?.message}
            helper={mode === 'sign-up' ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
          >
            <View style={styles.passwordRow}>
              <AppInput
                ref={passwordRef}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(fieldState.error)}
                placeholder={mode === 'sign-up' ? 'Create a password' : 'Your password'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                // iOS-only. Not `newPassword`: with an email field above it, iOS silently fills
                // an "Automatic Strong Password" the user never sees, and without Associated
                // Domains (webcredentials) it is not offered back at sign-in, so the account
                // is unreachable (found in simulator E2E). Revisit once Associated Domains exist.
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                accessibilityLabel="Password"
                style={styles.passwordInput}
                testID="auth-password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.toggle}
              >
                <AppText variant="small" color="primary">
                  {showPassword ? 'Hide' : 'Show'}
                </AppText>
              </Pressable>
            </View>
          </FormField>
        )}
      />
      {error ? <InlineMessage tone="error" message={error} testID="auth-error" /> : null}
      <AppButton
        label={mode === 'sign-up' ? 'Create account' : 'Sign in'}
        fullWidth
        onPress={() => void submit()}
        disabled={!isValid && isSubmitted}
        loading={isSubmitting}
        testID="auth-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 72 },
  toggle: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
});
