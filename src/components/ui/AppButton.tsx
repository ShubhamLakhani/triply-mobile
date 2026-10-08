import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, MIN_TOUCH_TARGET, radius, spacing, type ColorToken } from '@/theme';

import { AppText } from './AppText';

export type AppButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: AppButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_STYLE: Record<
  AppButtonVariant,
  { background: ColorToken; border: ColorToken; text: ColorToken }
> = {
  primary: { background: 'primary', border: 'primary', text: 'onPrimary' },
  secondary: { background: 'surface', border: 'border', text: 'textPrimary' },
  // Destructive style is reserved for block / delete / ban (UI/UX Spec §40).
  destructive: { background: 'danger', border: 'danger', text: 'onDanger' },
};

export function AppButton({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth = false,
  accessibilityLabel,
  ...rest
}: AppButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const tokens = VARIANT_STYLE[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors[tokens.background],
          borderColor: colors[tokens.border],
        },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors[tokens.text]} accessibilityElementsHidden />
        ) : null}
        <AppText variant="button" color={tokens.text}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(MIN_TOUCH_TARGET, 48),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
