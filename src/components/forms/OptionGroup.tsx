import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors, MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

export interface OptionItem<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface OptionGroupProps<T extends string> {
  options: readonly OptionItem<T>[];
  value: T | T[] | null | undefined;
  onChange: (value: T) => void;
  /** Multi-select renders checkboxes; single renders radios. */
  multiple?: boolean;
  accessibilityLabel: string;
  testID?: string;
}

/** Tappable option rows (radio or checkbox semantics) used for gender and preferences. */
export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  accessibilityLabel,
  testID,
}: OptionGroupProps<T>) {
  const isSelected = (option: T) =>
    Array.isArray(value) ? value.includes(option) : value === option;
  return (
    <View
      style={styles.group}
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={({ pressed }) => [
              styles.row,
              selected && styles.rowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.text}>
              <AppText variant="bodyStrong">{option.label}</AppText>
              {option.description ? (
                <AppText variant="small" color="textSecondary">
                  {option.description}
                </AppText>
              ) : null}
            </View>
            <View
              style={[
                styles.indicator,
                multiple && styles.square,
                selected && styles.indicatorSelected,
              ]}
            >
              {selected ? <Icon name="check" size={14} rawColor={colors.onPrimary} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  row: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  pressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  square: { borderRadius: 6 },
  indicatorSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
