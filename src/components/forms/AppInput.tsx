import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, fontFamily, maxFontSizeMultiplier, radius, spacing } from '@/theme';

export interface AppInputProps extends TextInputProps {
  invalid?: boolean;
}

/** Themed text input. Pair with <FormField> for label, helper and error. */
export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  { invalid = false, multiline, style, editable = true, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      multiline={multiline}
      editable={editable}
      // Compose with the caller's handlers (e.g. react-hook-form's onBlur) so the focus
      // border always clears when the field loses focus.
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        multiline && styles.multiline,
        focused && styles.focused,
        invalid && styles.invalid,
        !editable && styles.disabled,
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
});
