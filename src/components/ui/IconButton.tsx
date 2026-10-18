import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, MIN_TOUCH_TARGET, radius } from '@/theme';

import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  /** Required: icons are decorative, the button needs a spoken name. */
  accessibilityLabel: string;
  variant?: 'plain' | 'filled' | 'overlay';
  size?: number;
}

/** 44pt round icon button. `overlay` is for controls placed on photos. */
export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'plain',
  size = MIN_TOUCH_TARGET,
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        variant === 'filled' && styles.filled,
        variant === 'overlay' && styles.overlay,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.45)}
        rawColor={variant === 'overlay' ? colors.surface : colors.textPrimary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  overlay: { backgroundColor: 'rgba(21, 19, 29, 0.55)' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
