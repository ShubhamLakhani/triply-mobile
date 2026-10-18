import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { colors, radius, spacing } from '@/theme';

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Human-readable value, e.g. "3 days". */
  format?: (value: number) => string;
  testID?: string;
}

/** Numeric stepper with large, labelled targets. Works identically on iOS and Android. */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  testID,
}: StepperProps) {
  const display = format ? format(value) : String(value);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: display }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + step));
        if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - step));
      }}
      testID={testID}
    >
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.controls}>
        <IconButton
          icon="minus"
          accessibilityLabel={`Decrease ${label}`}
          variant="filled"
          size={40}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
          testID={testID ? `${testID}-decrement` : undefined}
        />
        <AppText
          variant="bodyStrong"
          style={styles.value}
          testID={testID ? `${testID}-value` : undefined}
        >
          {display}
        </AppText>
        <IconButton
          icon="plus"
          accessibilityLabel={`Increase ${label}`}
          variant="filled"
          size={40}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
          testID={testID ? `${testID}-increment` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { minWidth: 64, textAlign: 'center' },
});
