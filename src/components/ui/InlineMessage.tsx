import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface InlineMessageProps {
  tone: 'error' | 'info' | 'success';
  title?: string;
  message: string;
  testID?: string;
}

/** Non-blocking status message for save failures, offline notices and confirmations. */
export function InlineMessage({ tone, title, message, testID }: InlineMessageProps) {
  const accent =
    tone === 'error' ? colors.danger : tone === 'success' ? colors.success : colors.info;
  return (
    <View
      style={[styles.base, { borderLeftColor: accent }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {title ? <AppText variant="bodyStrong">{title}</AppText> : null}
      <AppText variant="small" color="textSecondary">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xxs,
  },
});
