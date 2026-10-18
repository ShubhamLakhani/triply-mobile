import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { spacing } from '@/theme';

import { authError, toAuthError, type AppAuthError } from '../api/auth-errors';
import { useResendCooldown } from '../hooks/use-resend-cooldown';
import { EMAIL_CODE_LENGTH } from '../schemas/auth.schema';

import { CodeInput } from './CodeInput';

export interface EmailCodeFormProps {
  email: string;
  /** When the newest code was requested on this device (drives the resend countdown). */
  sentAt: number | null;
  /** Verifies the code; throws AppAuthError (code_invalid / code_expired / network …). */
  verify: (code: string) => Promise<void>;
  /** Requests a new code; throws AppAuthError (rate_limited, network …). */
  resend: () => Promise<void>;
  onChangeEmail: () => void;
  submitLabel?: string;
  /** testID prefix, e.g. `verify-email` → `verify-email-code`, `verify-email-submit`. */
  testID: string;
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Six-digit email code entry with verify, resend (with countdown) and change-email. Every
 * failure settles into a fixed, user-safe message; nothing waits forever (auth requests time
 * out, see auth-api.ts).
 */
export function EmailCodeForm({
  email,
  sentAt,
  verify,
  resend,
  onChangeEmail,
  submitLabel = 'Verify',
  testID,
}: EmailCodeFormProps) {
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<AppAuthError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useResendCooldown(sentAt);

  const submit = async (value: string) => {
    if (verifying) return;
    if (value.length !== EMAIL_CODE_LENGTH) {
      setError(authError('code_invalid'));
      return;
    }
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      await verify(value);
    } catch (cause) {
      const next = toAuthError(cause);
      setError(next);
      if (next.code === 'code_invalid' || next.code === 'code_expired') {
        setCode('');
        inputRef.current?.focus();
      }
      setVerifying(false);
    }
    // On success the screen is replaced by the router; keep the loading state until then.
  };

  const requestNewCode = async () => {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await resend();
      setCode('');
      setNotice('We sent a new code. Only the newest code works.');
      inputRef.current?.focus();
    } catch (cause) {
      setError(toAuthError(cause));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppText variant="body" color="textSecondary">
        We sent a {EMAIL_CODE_LENGTH}-digit code to{' '}
        <AppText variant="bodyStrong" testID={`${testID}-email`}>
          {email}
        </AppText>
        . It expires in 1 hour.
      </AppText>
      <CodeInput
        ref={inputRef}
        value={code}
        onChangeText={(next) => {
          setCode(next);
          if (error) setError(null);
        }}
        onComplete={(full) => void submit(full)}
        invalid={error?.code === 'code_invalid' || error?.code === 'code_expired'}
        editable={!verifying}
        testID={`${testID}-code`}
      />
      {error ? (
        <InlineMessage tone="error" message={error.message} testID={`${testID}-error`} />
      ) : null}
      {notice ? (
        <InlineMessage tone="success" message={notice} testID={`${testID}-notice`} />
      ) : null}
      <AppButton
        label={submitLabel}
        fullWidth
        loading={verifying}
        disabled={code.length !== EMAIL_CODE_LENGTH}
        onPress={() => void submit(code)}
        testID={`${testID}-submit`}
      />
      <AppButton
        label={cooldown > 0 ? `Resend code in ${formatCountdown(cooldown)}` : 'Resend code'}
        variant="secondary"
        fullWidth
        loading={resending}
        disabled={cooldown > 0 || verifying}
        onPress={() => void requestNewCode()}
        testID={`${testID}-resend`}
      />
      <AppText variant="small" color="textSecondary">
        Can’t find it? Check spam or promotions.
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={onChangeEmail}
        hitSlop={8}
        disabled={verifying}
        testID={`${testID}-change-email`}
      >
        <AppText variant="small" color="primary" style={styles.link}>
          Use a different email
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  link: { fontFamily: 'Inter_600SemiBold' },
});
