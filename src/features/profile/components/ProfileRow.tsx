import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors, MIN_TOUCH_TARGET, spacing } from '@/theme';

export interface ProfileRowProps {
  label: string;
  value?: string | null;
  placeholder?: string;
  onPress: () => void;
  testID?: string;
}

/** Settings-style row: label, current value (or a nudge), chevron. */
export function ProfileRow({
  label,
  value,
  placeholder = 'Add',
  onPress,
  testID,
}: ProfileRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? placeholder}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <AppText variant="caption" color="textSecondary">
          {label.toUpperCase()}
        </AppText>
        <AppText variant="body" color={value ? 'textPrimary' : 'primary'} numberOfLines={2}>
          {value ?? placeholder}
        </AppText>
      </View>
      <Icon name="chevron-right" size={18} color="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
});
