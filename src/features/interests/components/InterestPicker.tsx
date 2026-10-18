import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppChip } from '@/components/ui/AppChip';
import { AppText } from '@/components/ui/AppText';
import { Skeleton } from '@/components/ui/Skeleton';
import { spacing } from '@/theme';

import { MAX_INTERESTS, type InterestSummary } from '../types';

export interface InterestPickerProps {
  catalog: InterestSummary[] | undefined;
  selectedIds: readonly string[];
  onToggle: (interestId: string) => void;
  isLoading?: boolean;
  testID?: string;
}

function categoryTitle(category: string | null): string {
  if (!category) return 'More';
  return category.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Multi-select chips grouped by category with a live "n of 10" count; locks at the limit. */
export function InterestPicker({
  catalog,
  selectedIds,
  onToggle,
  isLoading,
  testID,
}: InterestPickerProps) {
  const groups = useMemo(() => {
    const map = new Map<string, InterestSummary[]>();
    for (const interest of catalog ?? []) {
      const key = categoryTitle(interest.category);
      map.set(key, [...(map.get(key) ?? []), interest]);
    }
    return [...map.entries()];
  }, [catalog]);
  const atLimit = selectedIds.length >= MAX_INTERESTS;

  if (isLoading && !catalog) {
    return (
      <View style={styles.skeletons} testID={testID ? `${testID}-loading` : undefined}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.skeletonRow}>
            <Skeleton width={96} height={40} round />
            <Skeleton width={120} height={40} round />
            <Skeleton width={80} height={40} round />
          </View>
        ))}
      </View>
    );
  }

  if (catalog && catalog.length === 0) {
    return (
      <AppText variant="body" color="textSecondary" testID={testID ? `${testID}-empty` : undefined}>
        There are no interests to choose from yet. You can add them later from your profile.
      </AppText>
    );
  }

  return (
    <View style={styles.root} testID={testID}>
      <AppText
        variant="small"
        color={atLimit ? 'primary' : 'textSecondary'}
        accessibilityLiveRegion="polite"
        testID={testID ? `${testID}-count` : undefined}
      >
        {atLimit
          ? `${MAX_INTERESTS} of ${MAX_INTERESTS} chosen — remove one to swap`
          : `${selectedIds.length} of ${MAX_INTERESTS} chosen`}
      </AppText>
      {groups.map(([title, interests]) => (
        <View key={title} style={styles.group}>
          <AppText variant="caption" color="textSecondary" style={styles.groupTitle}>
            {title.toUpperCase()}
          </AppText>
          <View style={styles.chips}>
            {interests.map((interest) => {
              const selected = selectedIds.includes(interest.id);
              return (
                <AppChip
                  key={interest.id}
                  label={interest.label}
                  selected={selected}
                  disabled={!selected && atLimit}
                  onPress={() => onToggle(interest.id)}
                  testID={`interest-${interest.slug}`}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  group: { gap: spacing.xs },
  groupTitle: { letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  skeletons: { gap: spacing.sm },
  skeletonRow: { flexDirection: 'row', gap: spacing.xs },
});
