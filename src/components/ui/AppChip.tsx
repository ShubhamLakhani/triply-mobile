import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotionPreference } from '@/hooks/use-motion-preference';
import { colors, MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface AppChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Selectable pill with a check mark (state is never colour-only). */
export function AppChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  testID,
}: AppChipProps) {
  const { duration } = useMotionPreference();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withTiming(0.96, { duration: duration('micro') }));
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: duration('micro') }));
      }}
      testID={testID}
      style={[
        styles.chip,
        selected ? styles.selected : styles.idle,
        disabled && !selected && styles.disabled,
        animated,
      ]}
    >
      {selected ? <Icon name="check" size={14} rawColor={colors.onPrimary} /> : null}
      <AppText variant="small" color={selected ? 'onPrimary' : 'textPrimary'} style={styles.label}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: Math.max(40, MIN_TOUCH_TARGET - 4),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.45 },
  label: { fontFamily: 'Inter_500Medium' },
});
