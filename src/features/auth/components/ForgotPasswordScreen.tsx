import { useState } from 'react';
import { Controller, useFormState } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AppInput } from '@/components/forms/AppInput';
import { FormField } from '@/components/forms/FormField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { useZodForm } from '@/hooks/use-zod-form';
import { useAnalytics } from '@/services/analytics';
import { captureError } from '@/services/observability';
import { spacing } from '@/theme';

import { requestPasswordReset, updatePassword, verifyRecoveryCode } from '../api/auth-api';
import { useAuth } from '../providers/AuthProvider';
import { emailSchema, newPasswordSchema, PASSWORD_MIN_LENGTH } from '../schemas/auth.schema';

import { AuthHero } from './AuthHero';
import { authErrorMessage } from './CredentialsForm';
import { EmailCodeForm } from './EmailCodeForm';

const requestSchema = z.object({ email: emailSchema }).strict();

function RequestCodeForm({
  initialEmail,
  onSent,
}: {
  initialEmail: string;
  onSent: (email: string) => void;
}) {
  const analytics = useAnalytics();
  const form = useZodForm(requestSchema, { defaultValues: { email: initialEmail } });
  const { isSubmitting } = useFormState({ control: form.control });
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await requestPasswordReset(values.email);
      analytics.track('password_reset_requested', {});
      onSent(values.email);
    } catch (cause) {
      setError(authErrorMessage(cause));
    }
  });

  return (
    <View style={styles.form}>
      <AppText variant="body" color="textSecondary">
        Enter the email you signed up with. We’ll send you a 6-digit code to reset your password.
      </AppText>
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
              returnKeyType="send"
              onSubmitEditing={() => void submit()}
              accessibilityLabel="Email"
              testID="reset-email"
            />
          </FormField>
        )}
      />
      {error ? <InlineMessage tone="error" message={error} testID="reset-request-error" /> : null}
      <AppButton
        label="Send code"
        fullWidth
        loading={isSubmitting}
        onPress={() => void submit()}
        testID="reset-request-submit"
      />
    </View>
  );
}

function NewPasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const analytics = useAnalytics();
  const form = useZodForm(newPasswordSchema, { defaultValues: { password: '', confirm: '' } });
  const { isSubmitting } = useFormState({ control: form.control });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await updatePassword(values.password);
      analytics.track('password_reset_completed', {});
      onDone();
    } catch (cause) {
      setError(authErrorMessage(cause));
    }
  });

  return (
    <View style={styles.form}>
      <AppText variant="body" color="textSecondary">
        Code confirmed. Choose a new password with at least {PASSWORD_MIN_LENGTH} characters.
      </AppText>
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField label="New password" error={fieldState.error?.message}>
            <View style={styles.passwordRow}>
              <AppInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(fieldState.error)}
                placeholder="New password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                // Same reason as sign-up: avoid an invisible iOS strong password (CredentialsForm).
                textContentType="password"
                accessibilityLabel="New password"
                style={styles.passwordInput}
                testID="reset-new-password"
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
      <Controller
        control={form.control}
        name="confirm"
        render={({ field, fieldState }) => (
          <FormField label="Confirm new password" error={fieldState.error?.message}>
            <AppInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              invalid={Boolean(fieldState.error)}
              placeholder="Repeat the new password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              accessibilityLabel="Confirm new password"
              testID="reset-confirm-password"
            />
          </FormField>
        )}
      />
      {error ? <InlineMessage tone="error" message={error} testID="reset-password-error" /> : null}
      <AppButton
        label="Save new password"
        fullWidth
        loading={isSubmitting}
        onPress={() => void submit()}
        testID="reset-password-submit"
      />
      <AppButton
        label="Cancel and sign out"
        variant="secondary"
        fullWidth
        disabled={isSubmitting}
        onPress={onCancel}
        testID="reset-cancel"
      />
    </View>
  );
}

/**
 * Forgot password: email → 6-digit recovery code → new password. Verifying the code signs the
 * user in (PASSWORD_RECOVERY); AuthProvider keeps the router on this screen until the new
 * password is saved, then the root guard continues to onboarding or the app.
 */
export function ForgotPasswordScreen() {
  const { passwordRecovery, finishPasswordRecovery, signOut } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);

  const step = passwordRecovery ? 'password' : email ? 'code' : 'email';

  return (
    <AppScreen
      scroll
      keyboardAware
      testID={`reset-${step}-screen`}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader onBack={step === 'password' ? false : undefined} />
      <AuthHero compact />
      <AppText variant="h2">
        {step === 'password' ? 'Set a new password' : 'Reset your password'}
      </AppText>
      {step === 'email' ? (
        <RequestCodeForm
          initialEmail=""
          onSent={(sentTo) => {
            setEmail(sentTo);
            setSentAt(Date.now());
          }}
        />
      ) : null}
      {step === 'code' && email ? (
        <>
          <InlineMessage
            tone="info"
            message="If an account exists for this email, the code is on its way."
          />
          <EmailCodeForm
            email={email}
            sentAt={sentAt}
            submitLabel="Continue"
            verify={async (code) => {
              await verifyRecoveryCode({ email, code, sentAt });
            }}
            resend={async () => {
              await requestPasswordReset(email);
              setSentAt(Date.now());
            }}
            onChangeEmail={() => {
              setEmail(null);
              setSentAt(null);
            }}
            testID="reset-code"
          />
        </>
      ) : null}
      {step === 'password' ? (
        <NewPasswordForm
          onDone={finishPasswordRecovery}
          onCancel={() => {
            signOut().catch((error: unknown) => captureError(error, { source: 'sign-out' }));
          }}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 72 },
  toggle: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
});
