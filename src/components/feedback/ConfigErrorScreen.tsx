import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { EnvIssue } from '@/config/env';
import { colors, radius, spacing } from '@/theme';

export interface ConfigErrorScreenProps {
  issues: readonly EnvIssue[];
  /** Show variable names (development builds). Release builds show a generic message. */
  showDetails: boolean;
}

/**
 * Shown instead of the app when required configuration is missing or unsafe, so a misconfigured
 * build fails loudly at launch rather than with mysterious runtime behaviour.
 */
export function ConfigErrorScreen({ issues, showDetails }: ConfigErrorScreenProps) {
  return (
    <View style={styles.container} accessibilityRole="alert" testID="config-error-screen">
      <AppText variant="h2">App configuration error</AppText>
      <AppText variant="body" color="textSecondary">
        {showDetails
          ? 'Fix the following values in .env.local (or the EAS environment) and restart Metro:'
          : 'This build is misconfigured. Please install the latest version.'}
      </AppText>
      {showDetails ? (
        <View style={styles.list}>
          {issues.map((issue) => (
            <AppText key={`${issue.variable}:${issue.message}`} variant="small">
              {`• ${issue.variable} ${issue.message}`}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  list: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderWidth: 1,
  },
});
