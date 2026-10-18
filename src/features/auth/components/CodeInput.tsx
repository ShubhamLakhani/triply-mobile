import { forwardRef } from 'react';
import { Platform, StyleSheet, type TextInput } from 'react-native';

import { AppInput } from '@/components/forms/AppInput';
import { fontFamily } from '@/theme';

import { EMAIL_CODE_LENGTH } from '../schemas/auth.schema';

export interface CodeInputProps {
  value: string;
  onChangeText: (code: string) => void;
  /** Called once the sixth digit is entered or pasted. */
  onComplete?: (code: string) => void;
  invalid?: boolean;
  editable?: boolean;
  testID?: string;
}

/**
 * One plain numeric field for the 6-digit email code (deliberately not six boxes: paste,
 * one-time-code autofill, screen readers and Android keyboards all work with a single input).
 * Non-digits are stripped, so a pasted "123 456" becomes "123456".
 */
export const CodeInput = forwardRef<TextInput, CodeInputProps>(function CodeInput(
  { value, onChangeText, onComplete, invalid, editable = true, testID },
  ref,
) {
  return (
    <AppInput
      ref={ref}
      value={value}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH);
        onChangeText(digits);
        if (digits.length === EMAIL_CODE_LENGTH && digits !== value) onComplete?.(digits);
      }}
      invalid={invalid}
      editable={editable}
      keyboardType="number-pad"
      inputMode="numeric"
      textContentType="oneTimeCode"
      autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
      autoCorrect={false}
      autoFocus
      // Allow a pasted code with a separator; the handler trims it to six digits.
      maxLength={EMAIL_CODE_LENGTH + 2}
      placeholder={'•'.repeat(EMAIL_CODE_LENGTH)}
      returnKeyType="done"
      accessibilityLabel={`${EMAIL_CODE_LENGTH}-digit code`}
      accessibilityHint="Enter the code from the email we sent you."
      style={styles.input}
      testID={testID}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 64,
    fontFamily: fontFamily.semibold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 10,
    textAlign: 'center',
  },
});
