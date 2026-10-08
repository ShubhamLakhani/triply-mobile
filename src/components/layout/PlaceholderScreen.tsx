import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FOUNDATION_PHASE } from '@/constants/app';
import { colors, radius, shadows, spacing } from '@/theme';

import { AppScreen } from './AppScreen';

export interface PlaceholderScreenProps {
  title: string;
  description: string;
  /** Roadmap milestone that will replace this placeholder. */
  plannedPhase: string;
  children?: ReactNode;
  testID?: string;
}

/** Architectural placeholder for routes whose product UI is built in later milestones. */
export function PlaceholderScreen({
  title,
  description,
  plannedPhase,
  children,
  testID,
}: PlaceholderScreenProps) {
  return (
    <AppScreen scroll testID={testID}>
      <AppText variant="h1">{title}</AppText>
      <View style={styles.card}>
        <AppText variant="body" color="textSecondary">
          {description}
        </AppText>
        <AppText variant="caption" color="primary">
          {`${FOUNDATION_PHASE} · built in ${plannedPhase}`}
        </AppText>
      </View>
      {children}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card,
  },
});
