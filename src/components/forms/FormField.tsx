import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme';

export interface FormFieldProps {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  /** Trailing text next to the label, e.g. a character count. */
  meta?: string;
}

/** Label + control + helper/error row. Errors are announced as alerts for assistive tech. */
export function FormField({
  label,
  helper,
  error,
  optional = false,
  meta,
  children,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText variant="small" style={styles.label}>
          {label}
          {optional ? (
            <AppText variant="small" color="textSecondary">
              {'  Optional'}
            </AppText>
          ) : null}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textSecondary">
            {meta}
          </AppText>
        ) : null}
      </View>
      {children}
      {error ? (
        <AppText
          variant="caption"
          color="danger"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: 'Inter_500Medium' },
});
