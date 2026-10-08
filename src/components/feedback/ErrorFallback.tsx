import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { colors, spacing } from '@/theme';

export interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Calm, non-technical error surface (UI/UX Spec §35). Never shows stack traces to users. */
export function ErrorFallback({
  title = 'Something went wrong',
  message = 'Please try again. If this keeps happening, restart the app.',
  onRetry,
}: ErrorFallbackProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {message}
      </AppText>
      {onRetry ? <AppButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
});
